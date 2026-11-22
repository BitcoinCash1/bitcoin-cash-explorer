import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import DB from '../../database';

const widths = [1800, 7200, 10800, 28800, 43200];
export const feeBands = [
  0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 250, 300, 350, 400, 500,
  600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000,
];
const bands = feeBands.map((fee) => 'size_' + fee);
const metrics = ['unconfirmed_transactions', 'bytes_per_second', 'min_fee'];
const fields = [...metrics, ...bands];

export const bucketSchema = `CREATE TABLE IF NOT EXISTS statistics_buckets (
  bucket_seconds SMALLINT UNSIGNED NOT NULL,
  bucket_start BIGINT NOT NULL,
  sample_count BIGINT UNSIGNED NOT NULL,
  fee_count BIGINT UNSIGNED NOT NULL,
  first_id INT NOT NULL,
  first_added BIGINT NOT NULL,
  earliest_added BIGINT NOT NULL,
  ${fields.map((f) => f + (f === 'min_fee' ? ' DOUBLE' : ' BIGINT') + ' NOT NULL').join(',\n  ')},
  PRIMARY KEY (bucket_seconds, bucket_start)
) ENGINE=InnoDB`;

// At 8 and 12 hours the API returns one observed set of fee bands. At shorter
// resolutions those same columns hold sums, so uneven sample counts are preserved.
const sizes = widths.map((w) => `SELECT ${w} AS seconds`).join(' UNION ALL ');
const columns = [
  'bucket_seconds',
  'bucket_start',
  'sample_count',
  'fee_count',
  'first_id',
  'first_added',
  'earliest_added',
  ...fields,
].join(', ');
const merge = [
  'earliest_added = LEAST(earliest_added, VALUES(earliest_added))',
  'sample_count = sample_count + VALUES(sample_count)',
  'fee_count = fee_count + VALUES(fee_count)',
  ...metrics.map((f) => `${f} = statistics_buckets.${f} + VALUES(${f})`),
  ...bands.map(
    (f) =>
      `${f} = IF(VALUES(bucket_seconds) < 28800, statistics_buckets.${f} + VALUES(${f}), IF(VALUES(first_id) < first_id, VALUES(${f}), statistics_buckets.${f}))`
  ),
  // MariaDB evaluates assignments in order, so update the representative ID last.
  'first_added = IF(VALUES(first_id) < first_id, VALUES(first_added), first_added)',
  'first_id = LEAST(first_id, VALUES(first_id))',
].join(', ');

const insertSample = `INSERT INTO statistics_buckets (${columns})
  SELECT w.seconds, UNIX_TIMESTAMP(s.added) DIV w.seconds * w.seconds, 1, s.min_fee IS NOT NULL,
    s.id, UNIX_TIMESTAMP(s.added), UNIX_TIMESTAMP(s.added), ${fields.map((f) => (f === 'min_fee' ? 'COALESCE(s.min_fee,0)' : 's.' + f)).join(', ')}
  FROM statistics s CROSS JOIN (${sizes}) w WHERE s.id = ? ORDER BY w.seconds
  ON DUPLICATE KEY UPDATE ${merge}`;

export async function insertStatistic(sql: string, params: unknown[] = []): Promise<number> {
  return DB.$transaction(async (connection) => {
    const [result] = await connection.query<ResultSetHeader>(sql, params);
    await connection.query(insertSample, [result.insertId]);
    return result.insertId;
  });
}

function batchSql(width: number): string {
  const sums = width < 28800 ? fields : metrics;
  return `INSERT INTO statistics_buckets (${columns})
    SELECT ${width}, g.slot, g.n, g.fees, g.rep, UNIX_TIMESTAMP(s.added), g.earliest,
      ${fields.map((f) => (sums.includes(f) ? 'g.sum_' + f : 's.' + f)).join(', ')}
    FROM (SELECT UNIX_TIMESTAMP(added) DIV ${width} * ${width} AS slot, COUNT(*) AS n,
      COUNT(min_fee) AS fees, MIN(id) AS rep, UNIX_TIMESTAMP(MIN(added)) AS earliest,
      ${sums.map((f) => `COALESCE(SUM(${f}),0) AS sum_${f}`).join(', ')}
      FROM statistics WHERE id > ? AND id <= ? GROUP BY slot) g
    JOIN statistics s ON s.id = g.rep ORDER BY g.slot
    ON DUPLICATE KEY UPDATE ${merge}`;
}

const batches = widths.map(batchSql);

export async function backfillBatch(): Promise<boolean> {
  return DB.$transaction(async (c) => {
    const [state] = await c.query<RowDataPacket[]>(
      `SELECT number FROM state WHERE name='statistics_bucket_cursor' FOR UPDATE`
    );
    if (!state.length) {
      throw new Error('Statistics bucket migration is missing');
    }
    const start = state[0].number;
    const [limit] = await c.query<RowDataPacket[]>(`SELECT number FROM state WHERE name='statistics_bucket_limit'`);
    const end = Math.min(start + 4096, limit[0].number);
    if (end <= start) {
      return false;
    }
    for (const sql of batches) {
      await c.query(sql, [start, end]);
    }
    await c.query(`UPDATE state SET number=? WHERE name='statistics_bucket_cursor'`, [end]);
    return true;
  });
}

export async function bucketsEnabled(): Promise<boolean> {
  const [rows] = await DB.query<RowDataPacket[]>(`SELECT number FROM state WHERE name='statistics_bucket_reads'`);
  return rows[0]?.number === 1;
}

function rawEdge(width: number, timesOnly: boolean) {
  const range = 'FROM statistics FORCE INDEX (added) WHERE added >= FROM_UNIXTIME(?) AND added < FROM_UNIXTIME(?)';
  if (timesOnly) {
    return `SELECT UNIX_TIMESTAMP(MIN(added)) AS added ${range} HAVING COUNT(*) > 0`;
  }
  const averaged = width < 28800 ? fields : metrics;
  const averages = averaged.map((f) => `, CAST(AVG(${f}) AS DOUBLE) AS ${f}`).join('');
  const values = fields.map((f) => ', ' + (averaged.includes(f) ? 'g.' : 's.') + f).join('');
  return `SELECT UNIX_TIMESTAMP(s.added) AS added${values}
    FROM (SELECT MIN(id) AS rep${averages} ${range}) g
    JOIN statistics s ON s.id = g.rep`;
}

// End is inclusive, as in the legacy BETWEEN. The UNION is one snapshot even
// when a live or replicated sample commits while the request is running.
// The legacy gap query walks the covering added index and observes the earliest
// timestamp in each slot. Replication rounds that time to the nearest slot.
export function historyQuery(width: number, start?: number, end?: number, timesOnly = false) {
  if (!widths.includes(width)) {
    throw new Error('Unsupported statistics bucket width');
  }
  const values = timesOnly
    ? ''
    : fields
        .map((f) => {
          if (width >= 28800 && bands.includes(f)) {
            return ', ' + f;
          }
          const count = f === 'min_fee' ? 'NULLIF(fee_count,0)' : 'sample_count';
          // Divide in floating point to match CAST(AVG(...) AS DOUBLE) on repeating fractions.
          return `, CAST(${f} AS DOUBLE) / ${count} AS ${f}`;
        })
        .join('');
  const whole = `SELECT ${timesOnly ? 'earliest_added' : 'first_added'} AS added${values} FROM statistics_buckets WHERE bucket_seconds = ?`;
  if (start === undefined || end === undefined) {
    return { sql: whole + ' ORDER BY bucket_start DESC', params: [width] };
  }
  const first = Math.ceil(start / width) * width;
  const after = Math.floor((end + 1) / width) * width;
  const parts: string[] = [];
  const params: number[] = [];
  if (first < after) {
    parts.push(whole + ' AND bucket_start >= ? AND bucket_start < ?');
    params.push(width, first, after);
  }
  // A narrow replication interval can sit within one slot or straddle two.
  for (const [lo, hi] of [
    [start, Math.min(first, end + 1)],
    [Math.max(after, start, first), end + 1],
  ]) {
    if (lo < hi) {
      parts.push(rawEdge(width, timesOnly));
      params.push(lo, hi);
    }
  }
  return { sql: parts.join(' UNION ALL ') + ' ORDER BY added DESC', params };
}

// Check occupied slots from both ends of the raw history before switching readers.
// Each comparison uses a single statement so concurrent writes cannot split the snapshot.
export async function verifyBuckets(): Promise<number> {
  const [bounds] = await DB.query<RowDataPacket[]>(
    'SELECT UNIX_TIMESTAMP(MIN(added)) AS oldest, UNIX_TIMESTAMP(MAX(added)) AS newest FROM statistics'
  );
  const times = [bounds[0].oldest, bounds[0].newest].filter((time) => time !== null);
  let checked = 0;
  for (const width of widths) {
    const starts = new Set(times.map((time) => Math.floor(time / width) * width));
    for (const start of starts) {
      const bucket = historyQuery(width, start, start + width - 1);
      const [rows] = await DB.query<RowDataPacket[]>(
        `SELECT 'raw' AS source, r.* FROM (${rawEdge(width, false)}) r
        UNION ALL SELECT 'bucket' AS source, b.* FROM (${bucket.sql}) b`,
        [start, start + width, ...bucket.params]
      );
      const raw = rows.find((row) => row.source === 'raw');
      const stored = rows.find((row) => row.source === 'bucket');
      if (!raw || !stored) {
        throw new Error(`Missing statistics at ${start} (${width}s)`);
      }
      for (const field of ['added', ...fields]) {
        const a = raw[field],
          b = stored[field];
        if (a === b) {
          continue;
        }
        if (a !== null && b !== null && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a))) {
          continue;
        }
        throw new Error(`Statistics differ for ${field} at ${start} (${width}s)`);
      }
      checked++;
    }
  }
  return checked;
}

export async function readHistory(width: number, interval: string): Promise<RowDataPacket[]> {
  let bounds: { start?: number; end?: number } = {};
  if (interval !== 'all') {
    const [rows] = await DB.query<RowDataPacket[]>(
      `SELECT UNIX_TIMESTAMP(NOW() - INTERVAL ${interval}) AS start, UNIX_TIMESTAMP() AS end`
    );
    bounds = { start: rows[0].start, end: rows[0].end };
  }
  const { sql, params } = historyQuery(width, bounds.start, bounds.end);
  const [rows] = await DB.query<RowDataPacket[]>({ sql, timeout: 120000 }, params);
  return rows;
}
