const path = require("node:path");
const build = process.argv[2];
const config = require(path.join(build, "config")).default;
require("./fixture-guard.cjs")(config);
const DB = require(path.join(build, "database")).default;
(async () => {
  await require(path.join(build, "api/database-migration")).default.$initializeOrMigrateDatabase();
  await DB.query(
    "INSERT IGNORE INTO pools(id,name,link,addresses,regexes,slug,unique_id) VALUES (1,'Large','', '[]','[]','large',1),(2,'Small','','[]','[]','small',2),(3,'Tiny','','[]','[]','tiny',3)"
  );
  const [cols] = await DB.query("SHOW COLUMNS FROM blocks");
  const row = {};
  for (const c of cols)
    if (c.Null === "NO" && c.Default === null)
      row[c.Field] = /timestamp|datetime/.test(c.Type)
        ? "FROM_UNIXTIME(1293000000+seq*500)"
        : /int|double|float|decimal/.test(c.Type)
          ? "0"
          : "''";
  Object.assign(row, {
    height: "seq-1",
    hash: "LPAD(seq-1,64,'0')",
    previous_block_hash: "LPAD(GREATEST(0,CAST(seq AS SIGNED)-2),64,'0')",
    blockTimestamp: "FROM_UNIXTIME(1293000000+(seq-1)*500)",
    median_timestamp: "FROM_UNIXTIME(1293000000+(seq-1)*500)",
    pool_id: "IF(seq % 100 = 99,3,IF(seq % 100 < 43,1,2))",
    reward: "5000000000",
    fee_span: "'[0,0,0,0,0,0,0]'",
    fee_percentiles: "'[]'",
    coinbase_addresses: "'[]'",
    coinbase_raw: "REPEAT('a',600)",
    coinbase_address: "'fixture'",
    header: "REPEAT('0',160)",
    version: "1",
    bits: "486604799",
    difficulty: "1",
    tx_count: "1",
    size: "1000000",
    utxoset_size: "0",
    total_input_amt: "0",
  });
  const insert = `INSERT INTO blocks (${Object.keys(row)
    .map((k) => "`" + k + "`")
    .join(",")}) SELECT ${Object.values(row).join(",")} FROM seq_1_to_1000000`;
  console.log("seeding blocks");
  await DB.query(insert);
  await DB.query(
    "INSERT INTO blocks_summaries(id,height,transactions,version) SELECT hash,height,CONCAT('[{\"padding\":\"',REPEAT('x',2048),'\"}]'),1 FROM blocks"
  );
  await DB.query("INSERT INTO prices(time,USD) VALUES(FROM_UNIXTIME(1292000000),1),(NOW(),500)");
  await DB.query("INSERT INTO blocks_prices(height,price_id) SELECT height,1 FROM blocks");
  await DB.query(
    "INSERT INTO hashrates(hashrate_timestamp,avg_hashrate,pool_id,share,type) SELECT FROM_UNIXTIME(1292803200+(seq-1)*86400),1,1,1,'daily' FROM seq_1_to_7000"
  );
  await DB.query(
    "INSERT INTO hashrates(hashrate_timestamp,avg_hashrate,pool_id,share,type) SELECT FROM_UNIXTIME(1292803200+(seq-1)*604800),1,2,1,'weekly' FROM seq_1_to_1000"
  );
  await DB.query(
    "INSERT INTO difficulty_adjustments(time,height,difficulty,adjustment) VALUES(FROM_UNIXTIME(1293000000),0,1,0)"
  );
  await DB.query("ANALYZE TABLE blocks,blocks_summaries,blocks_prices");
  const [sizes] = await DB.query(
    "SELECT TABLE_NAME,DATA_LENGTH,INDEX_LENGTH,TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()"
  );
  console.log(JSON.stringify(sizes));
  await DB.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
