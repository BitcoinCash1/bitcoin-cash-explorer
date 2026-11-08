import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..'
);
const packageJson = JSON.parse(
  readFileSync(join(frontendDirectory, 'package.json'), 'utf8')
);
const dockerConfig = JSON.parse(
  readFileSync(
    join(frontendDirectory, 'explorer-frontend-config.sample.json'),
    'utf8'
  )
);

let directory: string;

function runScript(name: string) {
  return spawnSync('pnpm', ['run', name], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: 'false',
      DOCKER_COMMIT_HASH: 'config-test',
    },
  });
}

function readArtifact(name: string): string {
  return readFileSync(
    join(directory, 'dist/explorer/browser/resources', name),
    'utf8'
  );
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'explorer-config-template-'));
  mkdirSync(join(directory, 'src/resources'), { recursive: true });
  mkdirSync(join(directory, 'dist/explorer/browser/resources'), {
    recursive: true,
  });

  const scripts = Object.fromEntries(
    [
      'config:defaults:explorer',
      'config:docker-template',
      'generate-config',
    ].map((name) => [name, packageJson.scripts[name]])
  );
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({ version: packageJson.version, scripts })
  );

  for (const name of [
    'generate-config.js',
    'update-config.js',
    'explorer-frontend-config.sample.json',
  ]) {
    copyFileSync(join(frontendDirectory, name), join(directory, name));
  }
  copyFileSync(
    join(frontendDirectory, 'src/index.explorer.html'),
    join(directory, 'src/index.explorer.html')
  );

  const result = runScript('config:defaults:explorer');
  expect(result.status, result.stdout + result.stderr).toBe(0);

  for (const name of ['config.js', 'config.template.js']) {
    copyFileSync(
      join(directory, 'src/resources', name),
      join(directory, 'dist/explorer/browser/resources', name)
    );
  }
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('Docker artifact configuration', () => {
  it('preserves the website configuration while supplying the full Docker runtime template', () => {
    const websiteConfig = readArtifact('config.js');
    expect(websiteConfig).not.toContain('window.__env.NGINX_HOSTNAME');

    const result = runScript('config:docker-template');
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readArtifact('config.js')).toBe(websiteConfig);

    const template = readArtifact('config.template.js');
    const placeholders = [...template.matchAll(/\$\{__([A-Z0-9_]+)__\}/g)].map(
      (match) => match[1]
    );
    expect(new Set(placeholders)).toEqual(new Set(Object.keys(dockerConfig)));
    expect(template).toContain("window.__env.GIT_COMMIT_HASH = 'config-test'");
    expect(template).toContain(
      `window.__env.PACKAGE_JSON_VERSION = '${packageJson.version}'`
    );
  });

  it('fails when the full Docker configuration is unavailable', () => {
    const websiteConfig = readArtifact('config.js');
    rmSync(join(directory, 'explorer-frontend-config.sample.json'));

    const result = runScript('config:docker-template');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('explorer-frontend-config.sample.json');
    expect(readArtifact('config.js')).toBe(websiteConfig);
  });
});
