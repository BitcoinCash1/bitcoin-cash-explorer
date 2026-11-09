import cluster from 'cluster';
import * as fs from 'fs';
import * as net from 'net';

/** Only ECONNREFUSED proves that a filesystem socket has no listener. */
function probeSocket(path: string): Promise<'refused' | 'missing'> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ path });
    let settled = false;
    const timer = setTimeout(() => finish(new Error('probe timed out after 1000ms')), 1000);
    const finish = (error?: Error, result?: 'refused' | 'missing'): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) {
        reject(error);
      } else {
        resolve(result!);
      }
    };
    socket.once('connect', () => finish(new Error('another server is already listening')));
    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNREFUSED') {
        finish(undefined, 'refused');
      } else if (error.code === 'ENOENT') {
        finish(undefined, 'missing');
      } else {
        finish(error);
      }
    });
  });
}

function inspectSocket(path: string): fs.Stats | undefined {
  try {
    const stat = fs.lstatSync(path);
    if (!stat.isSocket()) {
      throw new Error('path exists but is not a socket (regular files and symlinks are never removed)');
    }
    return stat;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

/** Run before listeners/workers start. The socket directory must be service-owned. */
export async function prepareUnixSocket(path: string): Promise<boolean> {
  if (!path || !cluster.isPrimary) {
    return false;
  }
  try {
    const original = inspectSocket(path);
    if (!original) {
      return false;
    }
    const result = await probeSocket(path);
    // Keep the identity check and unlink synchronous to avoid yielding between them.
    const current = inspectSocket(path);
    if (!current) {
      return false;
    }
    if (
      result !== 'refused' ||
      current.dev !== original.dev ||
      current.ino !== original.ino ||
      current.ctimeMs !== original.ctimeMs
    ) {
      throw new Error('socket path changed during inspection; refusing to remove it');
    }
    try {
      fs.unlinkSync(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error) {
    throw new Error(`Cannot prepare Unix socket ${path}: ${error instanceof Error ? error.message : error}`, {
      cause: error,
    });
  }
}
