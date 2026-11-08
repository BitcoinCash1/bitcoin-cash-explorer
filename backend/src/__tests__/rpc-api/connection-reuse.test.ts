import * as http from 'http';
import * as https from 'https';
import { setTimeout as realSetTimeout } from 'timers';
import { AddressInfo } from 'net';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
const { JsonRPC } = require('../../rpc-api/jsonrpc');
const { Client } = require('../../rpc-api/index');

const pause = (ms: number) => new Promise((resolve) => realSetTimeout(resolve, ms));
let servers: (http.Server | https.Server)[];
let clients: any[];
beforeEach(() => {
  servers = [];
  clients = [];
});
afterEach(async () => {
  clients.forEach((client) => client.destroy());
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
          server.closeAllConnections();
        })
    )
  );
});
async function serve(handler: http.RequestListener, tls = false) {
  const server = tls
    ? https.createServer(
        {
          key: readFileSync(join(__dirname, 'fixtures/server-key.pem')),
          cert: readFileSync(join(__dirname, 'fixtures/server-cert.pem')),
        },
        handler
      )
    : http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}
function client(server: http.Server | https.Server, options = {}) {
  const rpc = new JsonRPC({
    host: '127.0.0.1',
    port: (server.address() as AddressInfo).port,
    timeout: 1000,
    ...options,
  });
  clients.push(rpc);
  return rpc;
}
function success(req: http.IncomingMessage, res: http.ServerResponse) {
  req.resume();
  res.end(JSON.stringify({ result: 42 }));
}

test('serial calls reuse one authenticated connection and retain only four idle sockets', async () => {
  const auth: string[] = [];
  const server = await serve((req, res) => {
    auth.push(req.headers.authorization!);
    success(req, res);
  });
  let connections = 0;
  server.on('connection', () => connections++);
  const rpc = client(server, { user: 'rpc', pass: 'secret' });
  for (let i = 0; i < 5; i++) expect(await rpc.call('getblockcount', [])).toBe(42);
  expect(connections).toBe(1);
  expect(auth).toEqual(Array(5).fill('Basic ' + Buffer.from('rpc:secret').toString('base64')));
  expect(rpc.agent.options).toMatchObject({ keepAlive: true, maxSockets: 16, maxFreeSockets: 4, scheduling: 'lifo' });
  await Promise.all(Array.from({ length: 32 }, () => rpc.call('getblockcount', [])));
  await pause(20);
  expect(Object.values(rpc.agent.freeSockets).flat().length).toBeLessThanOrEqual(4);
});

test('concurrency is capped at sixteen sockets and queued calls proceed', async () => {
  let active = 0;
  let peak = 0;
  const releases: (() => void)[] = [];
  const server = await serve((req, res) => {
    req.resume();
    peak = Math.max(peak, ++active);
    releases.push(() => {
      active--;
      res.end('{"result":42}');
    });
  });
  let connections = 0;
  server.on('connection', () => connections++);
  const rpc = client(server);
  const calls = Array.from({ length: 40 }, () => rpc.call('test', []));
  let settled = false;
  const results = Promise.all(calls).finally(() => {
    settled = true;
  });
  // Attach rejection handling immediately while the server releases queued waves.
  void results.catch(() => undefined);
  for (let turns = 0; turns < 100 && releases.length < 16; turns++) await pause(5);
  expect(releases.length).toBe(16);
  expect(connections).toBe(16);
  while (!settled) {
    releases.splice(0).forEach((release) => release());
    await pause(10);
  }
  expect(await results).toEqual(Array(40).fill(42));
  expect(peak).toBeLessThanOrEqual(16);
});

test('absolute deadline expires queued requests without sending them', async () => {
  const responses: http.ServerResponse[] = [];
  const server = await serve((req, res) => {
    req.resume();
    responses.push(res);
  });
  const rpc = client(server);
  const busy = Array.from({ length: 16 }, () => rpc.call('busy', []));
  for (let turns = 0; turns < 100 && responses.length < 16; turns++) await pause(5);
  rpc.opts.timeout = 50;
  const queued = rpc.call('expired', []);
  await expect(queued).rejects.toMatchObject({ code: 'ETIMEDOUT' });
  responses.forEach((res) => res.end('{"result":42}'));
  await Promise.all(busy);
  await pause(30);
  expect(responses).toHaveLength(16);
  rpc.opts.timeout = 1000;
  const recovery = rpc.call('recovery', []);
  for (let turns = 0; turns < 100 && responses.length < 17; turns++) await pause(5);
  responses[16].end('{"result":42}');
  await expect(recovery).resolves.toBe(42);
});

test('deadline covers a slowly arriving body after headers', async () => {
  const server = await serve((req, res) => {
    req.resume();
    res.write('{"result":"');
    const interval = setInterval(() => res.write('x'), 10);
    res.on('close', () => clearInterval(interval));
  });
  const rpc = client(server, { timeout: 80 });
  const started = Date.now();
  await expect(rpc.call('slow', [])).rejects.toMatchObject({ code: 'ETIMEDOUT' });
  expect(Date.now() - started).toBeLessThan(500);
  expect(rpc.pending.size).toBe(0);
});

test.each(['not JSON', 'null', '{}', '[]', '{"error":{"code":-8,"message":"bad parameter"}}'])(
  'malformed and RPC errors settle and allow recovery: %s',
  async (body) => {
    let count = 0;
    const server = await serve((req, res) => {
      req.resume();
      res.end(count++ === 0 ? body : '{"result":42}');
    });
    const rpc = client(server);
    await expect(rpc.call('bad', [])).rejects.toBeInstanceOf(Error);
    expect(rpc.pending.size).toBe(0);
    await expect(rpc.call('good', [])).resolves.toBe(42);
  }
);

test('truncated bodies reject promptly and release the pool for recovery', async () => {
  let count = 0;
  const server = await serve((req, res) => {
    req.resume();
    if (count++ === 0) {
      res.writeHead(200, { 'Content-Length': '100' });
      res.write('{"result":');
      setImmediate(() => res.destroy());
    } else success(req, res);
  });
  const rpc = client(server);
  await expect(rpc.call('truncated', [])).rejects.toBeInstanceOf(Error);
  expect(rpc.pending.size).toBe(0);
  await expect(rpc.call('good', [])).resolves.toBe(42);
});

test('server idle closes recover on the next call without retries', async () => {
  const server = await serve(success);
  server.keepAliveTimeout = 20;
  let connections = 0;
  server.on('connection', () => connections++);
  const rpc = client(server);
  await rpc.call('first', []);
  await pause(100);
  await expect(rpc.call('second', [])).resolves.toBe(42);
  expect(connections).toBe(2);
});

test('HTTPS verifies certificates, supports explicit CA and preserves strict opt-out', async () => {
  const server = await serve(success, true);
  await expect(client(server, { ssl: true }).call('strict', [])).rejects.toMatchObject({
    code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
  });
  const trusted = client(server, { ssl: true, sslCa: readFileSync(join(__dirname, 'fixtures/server-cert.pem')) });
  await expect(trusted.call('trusted', [])).resolves.toBe(42);
  await expect(trusted.call('reused', [])).resolves.toBe(42);
  await expect(client(server, { ssl: true, sslStrict: false }).call('insecure', [])).resolves.toBe(42);
});

test('cookie authentication reloads after rejection without retrying the failed call', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'rpc-cookie-'));
  const cookie = join(directory, 'cookie');
  let requests = 0;
  const server = await serve((req, res) => {
    req.resume();
    requests++;
    if (req.headers.authorization === 'Basic ' + Buffer.from('user:new').toString('base64')) res.end('{"result":42}');
    else {
      res.statusCode = 401;
      res.end('Unauthorized');
    }
  });
  try {
    writeFileSync(cookie, 'user:old');
    const rpc = client(server, { cookie });
    await expect(rpc.call('old', [])).rejects.toBeInstanceOf(Error);
    writeFileSync(cookie, 'user:new');
    await expect(rpc.call('new', [])).resolves.toBe(42);
    expect(requests).toBe(2);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test('client destroy is idempotent, closes sockets and rejects active, queued and future calls', async () => {
  const server = await serve((req) => req.resume());
  const wrapped = new Client({ host: '127.0.0.1', port: (server.address() as AddressInfo).port });
  clients.push(wrapped);
  const calls = Array.from({ length: 20 }, () => wrapped.getBlockCount());
  const results = Promise.allSettled(calls);
  await pause(30);
  wrapped.destroy();
  wrapped.destroy();
  expect((await results).every((result) => result.status === 'rejected')).toBe(true);
  expect(wrapped.rpc.pending.size).toBe(0);
  await expect(wrapped.getBlockCount()).rejects.toThrow('destroyed');
  await pause(30);
  expect(Object.values(wrapped.rpc.agent.sockets).flat()).toHaveLength(0);
});

test('transport resets reject once without retries and the next call reconnects', async () => {
  let requests = 0;
  const server = await serve((req, res) => {
    if (++requests === 1) req.socket.destroy();
    else success(req, res);
  });
  const rpc = client(server);
  await expect(rpc.call('reset', [])).rejects.toMatchObject({ code: 'ECONNRESET' });
  await pause(20);
  expect(requests).toBe(1);
  expect(rpc.pending.size).toBe(0);
  await expect(rpc.call('recovery', [])).resolves.toBe(42);
});

test('batch payload and first-result behavior remain unchanged', async () => {
  let payload;
  const server = await serve(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    payload = JSON.parse(body);
    res.end(JSON.stringify([{ result: 'first' }, { result: 'second' }]));
  });
  const rpc = client(server);
  await expect(
    rpc.call([
      { method: 'one', params: [1] },
      { method: 'two', params: [2] },
    ])
  ).resolves.toBe('first');
  expect(payload).toMatchObject([
    { method: 'one', params: [1] },
    { method: 'two', params: [2] },
  ]);
  expect(payload[0].id).toMatch(/-0$/);
  expect(payload[1].id).toMatch(/-1$/);
});

test('destroy also closes retained idle sockets', async () => {
  const server = await serve(success);
  const rpc = client(server);
  await rpc.call('first', []);
  await pause(10);
  expect(Object.values(rpc.agent.freeSockets).flat()).toHaveLength(1);
  rpc.destroy();
  await pause(20);
  expect(Object.values(rpc.agent.freeSockets).flat()).toHaveLength(0);
});

test.each(['stalled', 'truncated'])(
  'releases a saturated pool after sixteen %s bodies so a queued healthy call succeeds',
  async (failure) => {
    const blocked: http.ServerResponse[] = [];
    let requests = 0;
    const server = await serve((req, res) => {
      req.resume();
      if (++requests <= 16) {
        res.writeHead(200, { 'Content-Length': '100' });
        res.write('{"result":');
        blocked.push(res);
      } else res.end('{"result":42}');
    });
    // Control absolute deadlines while leaving socket I/O and polling on real time.
    // A busy runner must not expire occupied slots before the queue assertion.
    jest.useFakeTimers({
      doNotFake: ['Date', 'hrtime', 'performance', 'nextTick', 'queueMicrotask', 'setImmediate', 'clearImmediate'],
    });
    try {
      const rpc = client(server, { timeout: 30000 });
      const failures = Promise.allSettled(Array.from({ length: 16 }, () => rpc.call('blocked', [])));
      for (let turns = 0; turns < 100 && blocked.length < 16; turns++) await pause(2);
      expect(blocked).toHaveLength(16);
      // Give the queued request a later deadline than the sixteen occupied slots.
      rpc.opts.timeout = 60000;
      const healthy = rpc.call('healthy', []);
      expect(Object.values(rpc.agent.requests).flat()).toHaveLength(1);
      if (failure === 'truncated') blocked.forEach((res) => res.destroy());
      else await jest.advanceTimersByTimeAsync(30000);
      await expect(healthy).resolves.toBe(42);
      const settled = await failures;
      expect(settled.every((result) => result.status === 'rejected')).toBe(true);
      if (failure === 'stalled') {
        settled.forEach((result) =>
          expect((result as PromiseRejectedResult).reason).toMatchObject({ code: 'ETIMEDOUT' })
        );
      }
      expect(requests).toBe(17);
      expect(rpc.pending.size).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  }
);
