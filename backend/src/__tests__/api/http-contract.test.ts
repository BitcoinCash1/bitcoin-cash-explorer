import { fork, ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

// Run the actual application in a separate process: Jest's module mocks must not
// replace routing, body parsers, or query parsing in this compatibility check.
let child: ChildProcess;
let directory: string;
let baseUrl: string;
let diagnostics = '';
const backendDirectory = path.resolve(__dirname, '../../..');
const txid = '1'.repeat(64);

beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bch-http-contract-'));
  const configFile = path.join(directory, 'config.json');
  const preloadFile = path.join(directory, 'report-port.cjs');
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      EXPLORER: {
        ENABLED: false,
        HTTP_PORT: 0,
        BACKEND: 'none',
        CACHE_ENABLED: false,
        EXTERNAL_ASSETS: [],
        SPAWN_CLUSTER_PROCS: 0,
        UNIX_SOCKET_PATH: '',
      },
      DATABASE: { ENABLED: false },
      VALKEY: { ENABLED: false },
      FIAT_PRICE: { ENABLED: false },
      STATISTICS: { ENABLED: false },
      SYSLOG: { ENABLED: false },
      REPLICATION: { ENABLED: false },
      STRATUM: { ENABLED: false },
      CORE_RPC: { HOST: '127.0.0.1', PORT: 1, USERNAME: '', PASSWORD: '' },
    })
  );
  // Report the real ephemeral listening port without changing the application.
  fs.writeFileSync(
    preloadFile,
    `
    const http = require('node:http');
    const listen = http.Server.prototype.listen;
    http.Server.prototype.listen = function (...args) {
      this.once('listening', () => {
        const address = this.address();
        if (process.send && address && typeof address === 'object') process.send({ port: address.port });
      });
      return Reflect.apply(listen, this, args);
    };
  `
  );
  child = fork(path.join(backendDirectory, 'src/index.ts'), [], {
    cwd: backendDirectory,
    env: { ...process.env, EXPLORER_CONFIG_FILE: configFile },
    execArgv: ['--require', preloadFile, '--import', pathToFileURL(require.resolve('tsx')).href],
    silent: true,
  });
  child.stdout?.on('data', (data) => {
    diagnostics = (diagnostics + data.toString()).slice(-4000);
  });
  child.stderr?.on('data', (data) => {
    diagnostics = (diagnostics + data.toString()).slice(-4000);
  });
  baseUrl = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Backend startup timed out: ${diagnostics}`)), 15000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Backend exited (${code}): ${diagnostics}`));
    });
    child.once('message', (message: { port: number }) => {
      clearTimeout(timer);
      resolve(`http://127.0.0.1:${message.port}/api/v1`);
    });
  });
}, 20000);

afterAll(async () => {
  if (child && child.exitCode === null && child.signalCode === null) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill('SIGTERM');
    });
  }
  if (directory) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test.each([
  [`txId[]=${txid}`, [0]],
  [`txId[]=${txid}&txId[]=${'2'.repeat(64)}`, [0, 0]],
  [`txId=${txid}&txId=${'2'.repeat(64)}`, [0, 0]],
  [`txId[]=${txid}&txId[]=invalid`, [0]],
])('transaction-times preserves array query parsing: %s', async (query, expected) => {
  const response = await fetch(`${baseUrl}/transaction-times?${query}`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(await response.json()).toEqual(expected);
});

test('non-array transaction query retains its existing error contract', async () => {
  const response = await fetch(`${baseUrl}/transaction-times?txId=${txid}`);
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'Not an array' });
});

test('JSON request bodies reach the prevout handler as arrays', async () => {
  const response = await fetch(`${baseUrl}/prevouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '[]',
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
});

test('invalid JSON body shape is rejected before RPC access', async () => {
  const response = await fetch(`${baseUrl}/prevouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Invalid outpoints format' });
});

test.each([
  ['null entry', [null]],
  ['number entry', [0]],
  ['string entry', ['invalid']],
  ['boolean entry', [true]],
  ['array entry', [[]]],
  ['missing fields', [{}]],
  ['array transaction ID', [{ txid: [txid], vout: 0 }]],
  ['string output index', [{ txid, vout: '0' }]],
  ['null after a valid entry', [{ txid, vout: 0 }, null]],
])('invalid prevout %s returns 400', async (_name, body) => {
  const response = await fetch(`${baseUrl}/prevouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Invalid outpoints format' });
});

test('a valid outpoint still returns 200 when the prevout is unavailable', async () => {
  const response = await fetch(`${baseUrl}/prevouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ txid, vout: 0 }]),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([null]);
});

test('oversized batches retain the existing 400 error contract', async () => {
  const response = await fetch(`${baseUrl}/prevouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Array.from({ length: 251 }, () => ({ txid, vout: 0 }))),
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Too many outpoints requested' });
});

test('HEAD retains headers and omits the response body', async () => {
  const response = await fetch(`${baseUrl}/backend-info`, { method: 'HEAD' });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('access-control-allow-origin')).toBe('*');
  expect(await response.text()).toBe('');
});

test('unmatched paths return 404', async () => {
  const response = await fetch(`${baseUrl}/missing-contract-route`);
  expect(response.status).toBe(404);
});
