import fs from 'fs';
import net from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { fork, ChildProcess } from 'child_process';
import { once, EventEmitter } from 'events';
import { prepareUnixSocket } from '../../utils/unix-socket';

const fixture = join(__dirname, '../../../test-fixtures/unix-socket.cjs');
let directory: string;
const children: ChildProcess[] = [];

function spawn(
  mode: string,
  path: string
): { child: ChildProcess; exit: Promise<any[]>; message: Promise<any[]>; errors: () => string } {
  const child = fork(fixture, [mode, path], {
    execArgv: ['-r', 'ts-node/register/transpile-only'],
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  children.push(child);
  let stderr = '';
  child.stderr!.on('data', (chunk) => {
    stderr += chunk;
  });
  return { child, exit: once(child, 'exit'), message: once(child, 'message'), errors: () => stderr };
}

beforeEach(() => {
  directory = fs.mkdtempSync(join(tmpdir(), 'bch-socket-'));
});
afterEach(async () => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit');
      child.kill('SIGKILL');
      await exit;
    }
  }
  fs.rmSync(directory, { recursive: true, force: true });
});

it('does nothing when Unix serving is disabled', async () => {
  const inspect = jest.spyOn(fs, 'lstatSync');
  expect(await prepareUnixSocket('')).toBe(false);
  expect(inspect).not.toHaveBeenCalled();
});

it('binds an absent socket path without recovery', async () => {
  const process = spawn('prepare', join(directory, 'api.sock'));
  expect((await process.message)[0]).toEqual({ removed: false, listening: true });
  expect((await process.exit)[0]).toBe(0);
});

it('recovers a socket left by a killed process and can bind it again', async () => {
  const path = join(directory, 'api.sock');
  const server = spawn('serve', path);
  await server.message;
  server.child.kill('SIGKILL');
  await server.exit;
  expect(fs.lstatSync(path).isSocket()).toBe(true);
  const recovery = spawn('prepare', path);
  expect((await recovery.message)[0]).toEqual({ removed: true, listening: true });
  expect((await recovery.exit)[0]).toBe(0);
});

it('refuses to remove an active listener and leaves it reachable', async () => {
  const path = join(directory, 'api.sock');
  const server = spawn('serve', path);
  await server.message;
  const competing = spawn('prepare', path);
  expect((await competing.exit)[0]).toBe(1);
  expect(competing.errors()).toContain('already listening');
  const socket = net.createConnection(path);
  await once(socket, 'connect');
  socket.destroy();
  expect(fs.lstatSync(path).isSocket()).toBe(true);
});

it.each(['file', 'symlink'])('preserves a %s at the configured path', async (kind) => {
  const path = join(directory, 'api.sock');
  const target = join(directory, 'target');
  fs.writeFileSync(target, 'keep');
  if (kind === 'file') {
    fs.writeFileSync(path, 'keep');
  } else {
    fs.symlinkSync(target, path);
  }
  await expect(prepareUnixSocket(path)).rejects.toThrow('not a socket');
  expect(fs.readFileSync(path, 'utf8')).toBe('keep');
});

it('prepares once in the primary and skips cleanup in cluster workers', async () => {
  const path = join(directory, 'api.sock');
  const server = spawn('serve', path);
  await server.message;
  server.child.kill('SIGKILL');
  await server.exit;
  const process = spawn('cluster', path);
  expect((await process.message)[0]).toEqual({ removed: true, worker: { removed: false, worker: true } });
  expect((await process.exit)[0]).toBe(0);
});

function mockProbe(): EventEmitter & { destroy: jest.Mock } {
  const socket = Object.assign(new EventEmitter(), { destroy: jest.fn() });
  jest.spyOn(net, 'createConnection').mockReturnValue(socket as unknown as net.Socket);
  jest.spyOn(fs, 'lstatSync').mockReturnValue({ isSocket: () => true, dev: 1, ino: 2, ctimeMs: 3 } as fs.Stats);
  return socket;
}

it.each(['EACCES', 'EPERM', 'EIO'])('preserves the socket on ambiguous probe failure %s', async (code) => {
  const socket = mockProbe();
  const unlink = jest.spyOn(fs, 'unlinkSync');
  const pending = prepareUnixSocket('/private/api.sock');
  socket.emit('error', Object.assign(new Error(code), { code }));
  await expect(pending).rejects.toThrow(code);
  expect(unlink).not.toHaveBeenCalled();
  expect(socket.destroy).toHaveBeenCalled();
});

it('bounds a stalled probe without deleting the socket', async () => {
  jest.useFakeTimers();
  const socket = mockProbe();
  const unlink = jest.spyOn(fs, 'unlinkSync');
  const pending = prepareUnixSocket('/private/api.sock');
  const assertion = expect(pending).rejects.toThrow('timed out');
  jest.advanceTimersByTime(1000);
  await assertion;
  expect(unlink).not.toHaveBeenCalled();
  expect(socket.destroy).toHaveBeenCalled();
});

it('refuses to remove a replacement socket after probing', async () => {
  const socket = mockProbe();
  const unlink = jest.spyOn(fs, 'unlinkSync');
  const pending = prepareUnixSocket('/private/api.sock');
  jest.spyOn(fs, 'lstatSync').mockReturnValue({ isSocket: () => true, dev: 1, ino: 99, ctimeMs: 3 } as fs.Stats);
  socket.emit('error', Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }));
  await expect(pending).rejects.toThrow('changed during inspection');
  expect(unlink).not.toHaveBeenCalled();
});

it('allows disappearance during the probe without unlinking', async () => {
  const socket = mockProbe();
  const unlink = jest.spyOn(fs, 'unlinkSync');
  const pending = prepareUnixSocket('/private/api.sock');
  jest.spyOn(fs, 'lstatSync').mockImplementation(() => {
    throw Object.assign(new Error('missing'), { code: 'ENOENT' });
  });
  socket.emit('error', Object.assign(new Error('missing'), { code: 'ENOENT' }));
  expect(await pending).toBe(false);
  expect(unlink).not.toHaveBeenCalled();
});

it('reports directory permission failure without removing its socket', async () => {
  if (process.getuid?.() === 0) {
    return; // Root bypasses directory permissions; EACCES probing is covered above.
  }
  const path = join(directory, 'api.sock');
  const server = spawn('serve', path);
  await server.message;
  server.child.kill('SIGKILL');
  await server.exit;
  fs.chmodSync(directory, 0);
  try {
    const recovery = spawn('prepare', path);
    expect((await recovery.exit)[0]).toBe(1);
    expect(recovery.errors()).toContain('EACCES');
  } finally {
    fs.chmodSync(directory, 0o700);
  }
  expect(fs.lstatSync(path).isSocket()).toBe(true);
});
