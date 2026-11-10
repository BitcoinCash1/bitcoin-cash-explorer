import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const defaults = {
  MAX_BUFFERED_AMOUNT: 15000000,
  MAX_MESSAGE_SIZE: 100000,
  MAX_TRACKED_TXS: 500,
  MSG_RATE_LIMIT: 200,
  MSG_RATE_WINDOW: 10000,
  MAX_OUTSPENDS_OUTPUTS: 0,
};
const overrides = {
  MAX_BUFFERED_AMOUNT: 123456,
  MAX_MESSAGE_SIZE: 23456,
  MAX_TRACKED_TXS: 17,
  MSG_RATE_LIMIT: 23,
  MSG_RATE_WINDOW: 4567,
  MAX_OUTSPENDS_OUTPUTS: 100000,
};

test.each([defaults, overrides])('Docker entrypoint generates numeric request limits: %j', (expected) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bch-docker-config-'));
  const docker = path.resolve(__dirname, '../../../docker/backend');
  try {
    fs.copyFileSync(path.join(docker, 'explorer-config-template.json'), path.join(dir, 'explorer-config.json'));
    // Exercise the real substitutions; replace only the final application launch.
    const entrypoint = fs
      .readFileSync(path.join(docker, 'start.sh'), 'utf8')
      .replace('exec node /backend/package/index.js', ':');
    const script = path.join(dir, 'start.sh');
    fs.writeFileSync(script, entrypoint);
    const env = { PATH: process.env.PATH, EXPLORER_CACHE_DIR: path.join(dir, 'cache') };
    if (expected === overrides) {
      Object.assign(
        env,
        Object.fromEntries(Object.entries(overrides).map(([key, value]) => [`EXPLORER_${key}`, String(value)]))
      );
    }
    execFileSync('sh', [script], { cwd: dir, env });
    const generated = JSON.parse(fs.readFileSync(path.join(dir, 'explorer-config.json'), 'utf8'));
    expect(generated.EXPLORER).toMatchObject(expected);
    for (const key of Object.keys(expected)) {
      expect(typeof generated.EXPLORER[key]).toBe('number');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
