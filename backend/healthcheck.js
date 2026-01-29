const http = require("http");

const options = {
  host: "localhost",
  port: "8999",
  path: "/api/v1/mining/pools/24h",
  timeout: 2000,
};

const request = http
  .request(options, (res) => {
    let body = "";
    console.log(`STATUS: ${res.statusCode}`);

    res.on("data", (chunk) => {
      body += chunk;
    });

    res.on("end", () => {
      if (res.statusCode === 200) {
        try {
          const json = JSON.parse(body);
          if (
            json &&
            json.hasOwnProperty("pools") &&
            Array.isArray(json["pools"]) &&
            json["pools"].length >= 1 &&
            json.hasOwnProperty("blockCount") &&
            json["blockCount"] >= 1 &&
            json.hasOwnProperty("lastEstimatedHashrate") &&
            json["lastEstimatedHashrate"] >= 1
          ) {
            process.exit(0);
          } else {
            console.log("ERROR: JSON object is not containing all the data we want to see.");
            process.exit(1);
          }
        } catch (err) {
          console.log("ERROR: " + err.message);
          process.exit(1);
        }
      } else {
        console.log("ERROR: Status code is NOT 200 OK.");
        process.exit(1);
      }
    });
  })
  .on("error", (err) => {
    console.log("ERROR: " + err.message);
    process.exit(1);
  });

request.end();
