import { ResultSetHeader } from 'mysql2/promise';
import DB from '../database';
import { backfillBatch, verifyBuckets } from '../api/statistics/statistics-buckets';

async function run(command: string) {
  switch (command) {
    case 'backfill':
      while (await backfillBatch()) {
        // Yield between committed batches so live sampling can acquire its locks.
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      break;
    case 'verify':
      console.log(`Compared ${await verifyBuckets()} occupied buckets with raw statistics`);
      break;
    case 'enable': {
      const [result] = await DB.query<ResultSetHeader>(`UPDATE state SET number=1 WHERE name='statistics_bucket_reads'
        AND (SELECT number FROM state WHERE name='statistics_bucket_cursor') =
            (SELECT number FROM state WHERE name='statistics_bucket_limit')`);
      if (!result.affectedRows) {
        throw new Error('Missing migration or incomplete backfill');
      }
      break;
    }
    case 'disable':
      await DB.query(`UPDATE state SET number=0 WHERE name='statistics_bucket_reads'`);
      break;
    case 'status':
      break;
    default:
      throw new Error('Expected backfill, verify, enable, disable or status');
  }
  const [rows] = await DB.query(
    `SELECT name, number FROM state WHERE name IN ('statistics_bucket_reads','statistics_bucket_cursor','statistics_bucket_limit')`
  );
  console.table(rows);
}

run(process.argv[2])
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => DB.close());
