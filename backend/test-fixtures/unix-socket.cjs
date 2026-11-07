const net = require('net');
const cluster = require('cluster');
const { prepareUnixSocket } = require('../src/utils/unix-socket');
const [mode, path] = process.argv.slice(2);

(async () => {
  if (mode === 'serve') {
    net.createServer((socket) => socket.end()).listen(path, () => process.send({ listening: true }));
  } else if (mode === 'cluster') {
    const removed = await prepareUnixSocket(path);
    if (cluster.isPrimary) {
      const server = net.createServer((socket) => socket.end());
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(path, resolve); });
      const worker = cluster.fork();
      worker.on('message', (message) => {
        process.send({ removed, worker: message });
        server.close();
        worker.kill();
      });
      worker.on('exit', () => process.exit(0));
    } else {
      process.send({ removed, worker: true });
    }
  } else {
    const removed = await prepareUnixSocket(path);
    const server = net.createServer();
    server.on('error', (error) => { console.error(error.message); process.exit(1); });
    server.listen(path, () => {
      process.send({ removed, listening: true });
      server.close();
    });
  }
})().catch((error) => { console.error(error.message); process.exit(1); });
