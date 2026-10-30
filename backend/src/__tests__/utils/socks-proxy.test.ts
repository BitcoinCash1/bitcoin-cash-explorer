import fs from 'fs';
import http from 'http';
import https from 'https';
import net, { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import config from '../../config';
import * as proxyOptions from '../../utils/socks-proxy';
import { query } from '../../utils/axios-query';
import { query as queryReplica } from '../../replication/replicator';
import poolsUpdater from '../../tasks/pools-updater';
import syncAssets from '../../sync-assets';

// Test-only certificate for an unresolvable .invalid host, never a production identity.
const certificate = fs.readFileSync(path.join(__dirname, 'fixtures/socks-server-cert.pem'));
const key = fs.readFileSync(path.join(__dirname, 'fixtures/socks-server-key.pem'));
const payload = [{ ok: true }];
const connections: { hostname: string; username: string; password: string }[] = [];
const sockets = new Set<net.Socket>();
const agents = new Set<http.Agent>();
const counts = new Map<string, number>();
const originalOptions = proxyOptions.getSocksProxyOptions;
const originalWriteStream = fs.createWriteStream;
const originalSocks = { ...config.SOCKS5PROXY };
const originalExplorer = { ...config.EXPLORER };
let servers: net.Server[];
let plainPort: number;
let securePort: number;
let socksPort: number;
let outputDirectory: string;

function track(socket: net.Socket): net.Socket {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
  socket.on('error', () => {
    // The requesting Axios promise reports transport failures to each test.
  });
  return socket;
}
function listen(server: net.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}
function respond(req: http.IncomingMessage, res: http.ServerResponse): void {
  const name = req.url || '';
  const count = (counts.get(name) || 0) + 1;
  counts.set(name, count);
  if (name === '/fail' || name === '/failure.bin' || (name === '/retry' && count === 1)) {
    res.writeHead(503).end('Unavailable');
  } else if (name === '/truncated.bin') {
    res.writeHead(200, { 'Content-Length': '100' });
    res.write('short');
    setImmediate(() => res.destroy());
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  }
}
// Minimal SOCKS5 fixture. A domain address must reach the proxy without local DNS.
function acceptProxy(client: net.Socket): void {
  track(client);
  let buffer = Buffer.alloc(0);
  let stage = 'greeting';
  let username = '';
  let password = '';
  const consume = (data: Buffer): void => {
    buffer = Buffer.concat([buffer, data]);
    while (true) {
      if (stage === 'greeting') {
        if (buffer.length < 2 || buffer.length < 2 + buffer[1]) {
          return;
        }
        buffer = buffer.subarray(2 + buffer[1]);
        client.write(Buffer.from([5, 2]));
        stage = 'auth';
      } else if (stage === 'auth') {
        if (buffer.length < 2) {
          return;
        }
        const passwordOffset = 2 + buffer[1];
        if (buffer.length <= passwordOffset || buffer.length < passwordOffset + 1 + buffer[passwordOffset]) {
          return;
        }
        username = buffer.subarray(2, passwordOffset).toString();
        password = buffer.subarray(passwordOffset + 1, passwordOffset + 1 + buffer[passwordOffset]).toString();
        buffer = buffer.subarray(passwordOffset + 1 + buffer[passwordOffset]);
        client.write(Buffer.from([1, 0]));
        stage = 'connect';
      } else if (stage === 'connect') {
        if (buffer.length < 5) {
          return;
        }
        if (buffer[3] !== 3) {
          client.destroy(new Error('Expected remote DNS domain'));
          return;
        }
        const length = buffer[4];
        if (buffer.length < 7 + length) {
          return;
        }
        const hostname = buffer.subarray(5, 5 + length).toString();
        const port = buffer.readUInt16BE(5 + length);
        connections.push({ hostname, username, password });
        if (hostname !== 'fixture.invalid' || ![plainPort, securePort].includes(port)) {
          client.destroy(new Error('Unexpected destination'));
          return;
        }
        buffer = buffer.subarray(7 + length);
        stage = 'tunnel';
        client.removeListener('data', consume);
        const upstream = track(net.connect(port, '127.0.0.1'));
        upstream.on('error', () => client.destroy());
        client.on('close', () => upstream.destroy());
        upstream.on('connect', () => {
          client.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0]));
          if (buffer.length) {
            upstream.write(buffer);
          }
          client.pipe(upstream).pipe(client);
        });
        return;
      } else {
        return;
      }
    }
  };
  client.on('data', consume);
}

beforeAll(async () => {
  outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bch-socks-test-'));
  const plain = http.createServer(respond);
  const secure = https.createServer({ key, cert: certificate }, respond);
  const socks = net.createServer(acceptProxy);
  servers = [plain, secure, socks];
  plain.on('connection', track);
  secure.on('connection', track);
  plainPort = await listen(plain);
  securePort = await listen(secure);
  socksPort = await listen(socks);
});
beforeEach(() => {
  connections.length = 0;
  counts.clear();
  Object.assign(config.SOCKS5PROXY, { ENABLED: true, HOST: '127.0.0.1', PORT: socksPort, USERNAME: '', PASSWORD: '' });
  config.EXPLORER.USER_AGENT = 'socks-transport-test';
  config.EXPLORER.EXTERNAL_MAX_RETRY = 2;
  config.EXPLORER.EXTERNAL_RETRY_INTERVAL = 0;
  // Add only the fixture CA; TLS verification stays enabled.
  jest.spyOn(proxyOptions, 'getSocksProxyOptions').mockImplementation((attempt) => {
    const options = originalOptions(attempt);
    if (options.httpsAgent) {
      options.httpsAgent.options.ca = certificate;
      agents.add(options.httpsAgent);
    }
    return options;
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  for (const agent of agents) {
    agent.destroy();
  }
  agents.clear();
});
afterAll(async () => {
  Object.assign(config.SOCKS5PROXY, originalSocks);
  Object.assign(config.EXPLORER, originalExplorer);
  for (const socket of sockets) {
    socket.destroy();
  }
  await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  fs.rmSync(outputDirectory, { recursive: true, force: true });
});

test('disabled proxy leaves transport options unchanged', () => {
  config.SOCKS5PROXY.ENABLED = false;
  expect(originalOptions()).toEqual({});
});
test.each(['http', 'https'])('%s requests use SOCKS and remote DNS', async (protocol) => {
  const port = protocol === 'https' ? securePort : plainPort;
  expect(await query(`${protocol}://fixture.invalid:${port}/data`, true)).toEqual(payload);
  expect(connections).toEqual([{ hostname: 'fixture.invalid', username: 'circuit0', password: '' }]);
});
test('credentials containing URL delimiters arrive intact', async () => {
  config.SOCKS5PROXY.USERNAME = 'test@user:/%';
  config.SOCKS5PROXY.PASSWORD = 'test:p@ss/#%';
  expect(await query(`https://fixture.invalid:${securePort}/data`, true)).toEqual(payload);
  expect(connections[0]).toEqual({
    hostname: 'fixture.invalid',
    username: config.SOCKS5PROXY.USERNAME,
    password: config.SOCKS5PROXY.PASSWORD,
  });
});
test('retry changes the circuit authentication name', async () => {
  expect(await query(`https://fixture.invalid:${securePort}/retry`, true)).toEqual(payload);
  expect(connections.map((connection) => connection.username)).toEqual(['circuit0', 'circuit1']);
});
test('terminal errors retain throw-on-failure behavior', async () => {
  await expect(query(`http://fixture.invalid:${plainPort}/fail`, true)).rejects.toMatchObject({
    response: { status: 503 },
  });
  expect(connections).toHaveLength(2);
});
test('HTTP_PROXY cannot redirect a SOCKS-enabled request', async () => {
  const previous = process.env.HTTP_PROXY;
  process.env.HTTP_PROXY = 'http://127.0.0.1:1';
  try {
    expect(await query(`http://fixture.invalid:${plainPort}/data`, true)).toEqual(payload);
    expect(connections).toHaveLength(1);
  } finally {
    if (previous === undefined) {
      delete process.env.HTTP_PROXY;
    } else {
      process.env.HTTP_PROXY = previous;
    }
  }
});
test('replication and pool requests use the shared SOCKS transport', async () => {
  const url = `https://fixture.invalid:${securePort}/data`;
  expect(await queryReplica(url)).toEqual(payload);
  expect(await (poolsUpdater as any).query(url)).toEqual(payload);
  expect(connections).toHaveLength(2);
});
test('external assets are streamed over SOCKS', async () => {
  jest
    .spyOn(fs, 'createWriteStream')
    .mockImplementation((file, options) =>
      originalWriteStream(path.join(outputDirectory, path.basename(String(file))), options)
    );
  config.EXPLORER.EXTERNAL_ASSETS = [`https://fixture.invalid:${securePort}/asset.bin`];
  await syncAssets.syncAssets$();
  expect(fs.readFileSync(path.join(outputDirectory, 'asset.bin'), 'utf8')).toBe(JSON.stringify(payload));
  expect(connections).toHaveLength(1);
});
test.each(['failure.bin', 'truncated.bin'])('failed asset %s rejects instead of hanging', async (filename) => {
  jest
    .spyOn(fs, 'createWriteStream')
    .mockImplementation((file, options) =>
      originalWriteStream(path.join(outputDirectory, path.basename(String(file))), options)
    );
  config.EXPLORER.EXTERNAL_ASSETS = [`https://fixture.invalid:${securePort}/${filename}`];
  await expect(syncAssets.syncAssets$()).rejects.toThrow('Failed to download external asset');
});
