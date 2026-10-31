const http = require("node:http");
const count = 1000000;
const hash = (h) => String(h).padStart(64, "0");
http
  .createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const call = JSON.parse(body);
    const handle = (c) => {
      let result;
      switch (c.method) {
        case "getnetworkinfo":
          result = { subversion: "/BCHN:fixture/" };
          break;
        case "getblockchaininfo":
          result = { blocks: count - 1, headers: count - 1, bestblockhash: hash(count - 1) };
          break;
        case "getbestblockhash":
          result = hash(count - 1);
          break;
        case "getblockcount":
          result = count - 1;
          break;
        case "getblockhash":
          result = hash(c.params[0]);
          break;
        case "getindexinfo":
          result = {};
          break;
        case "getnetworkhashps":
          result = 1000000000000;
          break;
        case "getblock": {
          const h = Number(c.params[0]);
          result = {
            hash: hash(h),
            height: h,
            time: 1293840000 + h * 500,
            mediantime: 1293840000 + h * 500,
            version: 1,
            bits: "1d00ffff",
            nonce: 0,
            difficulty: 1,
            merkleroot: hash(0),
            tx: ["fixture"],
            size: 1000000,
            previousblockhash: h ? hash(h - 1) : undefined,
          };
          break;
        }
        default:
          return { result: null, error: { code: -32601, message: "Unexpected fixture RPC: " + c.method }, id: c.id };
      }
      return { result, error: null, id: c.id };
    };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(Array.isArray(call) ? call.map(handle) : handle(call)));
  })
  .listen(33418, "127.0.0.1");
