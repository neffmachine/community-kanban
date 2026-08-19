import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// setup.mjs and the seeder run once, by hand, on someone else's machine. Nothing
// else imports them, so a syntax error in either sits undetected until a new user
// hits it mid-install — the worst possible moment to find out. `node --check`
// parses a file without running it, which is all we need: setup.mjs would
// otherwise sit waiting on stdin and the seeder wants a config.
test('every shipped module parses', () => {
  const files = [
    'setup.mjs',
    'server.mjs',
    'scripts/seed-sample.mjs',
    'functions/_middleware.js',
    'functions/api/[[path]].js',
    ...readdirSync(join(root, 'src')).filter((f) => f.endsWith('.mjs')).map((f) => join('src', f)),
    ...readdirSync(join(root, 'src/db')).filter((f) => f.endsWith('.mjs')).map((f) => join('src/db', f)),
  ];
  assert.ok(files.length >= 10, `expected the full module set, found ${files.length}`);

  for (const rel of files) {
    try {
      execFileSync(process.execPath, ['--check', join(root, rel)], { stdio: 'pipe' });
    } catch (err) {
      assert.fail(`${rel} does not parse:\n${err.stderr?.toString().split('\n').slice(0, 4).join('\n')}`);
    }
  }
});
