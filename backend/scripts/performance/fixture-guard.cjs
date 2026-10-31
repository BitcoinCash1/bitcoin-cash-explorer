const path = require("node:path");
module.exports = (config) => {
  const dir = path.dirname(path.resolve(process.env.EXPLORER_CONFIG_FILE));
  if (
    config.DATABASE.HOST !== "127.0.0.1" ||
    config.DATABASE.PORT !== 33417 ||
    config.DATABASE.DATABASE !== "explorer_perf" ||
    config.VALKEY.UNIX_SOCKET_PATH !== path.join(dir, "socket", "valkey.sock") ||
    config.CORE_RPC.HOST !== "127.0.0.1" ||
    config.CORE_RPC.PORT !== 33418
  ) {
    throw new Error(
      "Disposable fixture config required: local ports 33417/33418, explorer_perf and adjacent fixture socket"
    );
  }
};
