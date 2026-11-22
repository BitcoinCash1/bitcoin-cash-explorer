import DB from '../database';
import { backfillBatch, enableBuckets, resetBuckets, verifyBuckets } from '../api/statistics/statistics-buckets';

async function backfill() {
  while (await backfillBatch()) {
    // Yield between committed batches so live sampling can acquire its locks.
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function verify() {
  console.log(`Compared ${await verifyBuckets()} occupied buckets with raw statistics`);
}

async function run(command: string) {
  switch (command) {
    case 'activate':
      await backfill();
      await verify();
      await enableBuckets();
      break;
    case 'backfill':
      await backfill();
      break;
    case 'verify':
      await verify();
      break;
    case 'reset':
      await resetBuckets();
      break;
    case 'enable':
      await enableBuckets();
      break;
    case 'disable':
      await DB.query(`UPDATE state SET number=0 WHERE name='statistics_bucket_reads'`);
      break;
    case 'status':
      break;
    default:
      throw new Error('Expected activate, reset, backfill, verify, enable, disable or status');
  }
  const [rows] = await DB.query(
    `SELECT name, number FROM state WHERE name IN ('statistics_bucket_reads','statistics_bucket_cursor','statistics_bucket_limit','statistics_bucket_last_id')`
  );
  console.table(rows);
}

run(process.argv[2])
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => DB.close());
