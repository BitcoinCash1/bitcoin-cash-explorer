import { fork } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import WebSocket from 'ws';

// Deliberately use a child process so Jest's global mocks cannot replace the
// actual signal handler, HTTP server, WebSocket server or database lifecycle.
test.each(['SIGTERM', 'SIGINT', 'cluster', 'cluster-failure', 'orphan-queue', 'deadline'] as const)(
  '%s shutdown handles active work and pool cleanup',
  async (signal) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bch-shutdown-'));
    const configFile = path.join(directory, 'config.json');
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        EXPLORER: {
          ENABLED: false,
          BACKEND: 'none',
          HTTP_PORT: 0,
          CACHE_ENABLED: false,
          EXTERNAL_ASSETS: [],
          SPAWN_CLUSTER_PROCS: signal.startsWith('cluster') ? 2 : 0,
          UNIX_SOCKET_PATH: '',
        },
        DATABASE: {
          ENABLED: false,
          HOST: '127.0.0.1',
          SOCKET: '',
          PORT: Number(process.env.SHUTDOWN_TEST_DB_PORT || 3306),
          DATABASE: 'shutdown_test',
          USERNAME: 'root',
          PASSWORD: '',
          PID_DIR: directory,
        },
        VALKEY: { ENABLED: false },
        FIAT_PRICE: { ENABLED: false },
        STATISTICS: { ENABLED: false },
        SYSLOG: { ENABLED: false },
        REPLICATION: { ENABLED: false },
        STRATUM: { ENABLED: false },
        CORE_RPC: { HOST: '127.0.0.1', PORT: 1, USERNAME: '', PASSWORD: '' },
      })
    );
    const child = fork(path.join(__dirname, '../../test/fixtures/shutdown-server.ts'), [], {
      cwd: path.resolve(__dirname, '../..'),
      env: {
        ...process.env,
        EXPLORER_CONFIG_FILE: configFile,
        SHUTDOWN_REAL_DB: process.env.SHUTDOWN_TEST_DB_PORT ? '1' : '',
        SHUTDOWN_TEST_DEADLINE: signal === 'deadline' || signal === 'orphan-queue' ? '1' : '',
        SHUTDOWN_TEST_ORPHANS: signal === 'orphan-queue' ? '1' : '',
        SHUTDOWN_TEST_WORKER_FAILURE: signal === 'cluster-failure' ? '1' : '',
      },
      execArgv: ['--import', pathToFileURL(require.resolve('tsx')).href],
      silent: true,
    });
    const events: string[] = [];
    const workerExits: { code: number | null; signal: string | null }[] = [];
    const waiters = new Map<string, (message: any) => void>();
    let diagnostics = '';
    child.stdout?.on('data', (data) => {
      diagnostics += data;
    });
    child.stderr?.on('data', (data) => {
      diagnostics += data;
    });
    child.on('message', (message: any) => {
      events.push(message.event);
      if (message.event === 'worker-exited') workerExits.push(message);
      waiters.get(message.event)?.(message);
    });
    const waitFor = (event: string) => new Promise<any>((resolve) => waiters.set(event, resolve));
    const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    const deadline = setTimeout(() => child.kill('SIGKILL'), 10000);
    let ws: WebSocket | undefined;
    try {
      const { port } = await waitFor('ready');
      if (signal === 'orphan-queue') {
        const started = waitFor('orphan-started');
        const drained = waitFor('orphans-drained');
        child.send('orphans');
        await started;
        child.kill('SIGTERM');
        const result = await drained;
        expect(result).toMatchObject({ indexed: 1, queued: 11 });
        expect(await exited).toEqual({ code: 0, signal: null });
        expect(events.indexOf('orphans-drained')).toBeLessThan(events.indexOf('pool-closing'));
        expect(events).toContain('pool-closed');
        expect(diagnostics).not.toContain('Shutdown exceeded');
        return;
      }
      if (signal === 'deadline') {
        const started = waitFor('background-started');
        child.send('stall');
        await started;
        child.kill('SIGTERM');
        expect(await exited).toEqual({ code: 1, signal: null });
        expect(diagnostics).toContain('Shutdown exceeded 50 seconds');
        expect(events).not.toContain('pool-closed');
        return;
      }
      ws = new WebSocket(`ws://127.0.0.1:${port}`);
      await new Promise<void>((resolve, reject) => {
        ws!.once('open', resolve);
        ws!.once('error', reject);
      });
      const socketClosed = new Promise<number>((resolve) => ws!.once('close', resolve));
      const started = waitFor('request-started');
      const response = fetch(`http://127.0.0.1:${port}/slow`).then((res) => res.text());
      await started;
      const background = waitFor('background-started');
      child.send('background');
      await background;
      child.kill(signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM');
      // Duplicate stop requests must not duplicate pool shutdown or interrupt work.
      child.kill(signal === 'SIGTERM' ? 'SIGINT' : 'SIGTERM');
      expect(await response).toBe('completed');
      expect(await socketClosed).toBe(1001);
      expect(await exited).toEqual({ code: signal === 'cluster-failure' ? 1 : 0, signal: null });
      expect(events.indexOf('background-completed')).toBeLessThan(events.indexOf('pool-closing'));
      expect(events.filter((event) => event === 'pool-closed')).toHaveLength(1);
      if (signal === 'cluster-failure') {
        expect(diagnostics).toContain('Shutdown failed: A cluster worker exited');
        expect(diagnostics).not.toContain('Shutdown completed');
        expect(workerExits.map(({ code }) => code)).toEqual([1, 1]);
      } else {
        expect(diagnostics).toContain('Shutdown completed');
      }
      if (signal.startsWith('cluster')) {
        expect(events.filter((event) => event === 'worker-exited')).toHaveLength(2);
        expect(diagnostics).not.toContain('Restarting in 10 seconds');
      }
    } finally {
      clearTimeout(deadline);
      ws?.terminate();
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
  15000
);
