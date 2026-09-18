#!/usr/bin/env node
/**
 * The domain contracts (types, constants, examinee schema builder) are vendored into BOTH apps
 * so each one is fully self-contained and deployable on its own. The server copy is the source
 * of truth; this script mirrors it into the client (or verifies the mirror with --check).
 */
import { cpSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../server/src/shared/', import.meta.url).pathname;
const DST = new URL('../client/src/shared/', import.meta.url).pathname;
const check = process.argv.includes('--check');

function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(relative(base, full));
  }
  return out.sort();
}

if (check) {
  const a = walk(SRC);
  const b = walk(DST);
  const drift = [];
  for (const f of new Set([...a, ...b])) {
    const left = a.includes(f) ? readFileSync(join(SRC, f), 'utf8') : null;
    const right = b.includes(f) ? readFileSync(join(DST, f), 'utf8') : null;
    if (left !== right) drift.push(f);
  }
  if (drift.length) {
    console.error(`shared/ drift between server and client:\n  ${drift.join('\n  ')}\nRun: npm run sync:shared`);
    process.exit(1);
  }
  console.log('shared/ in sync');
} else {
  rmSync(DST, { recursive: true, force: true });
  cpSync(SRC, DST, { recursive: true });
  console.log(`synced server/src/shared -> client/src/shared (${walk(SRC).length} files)`);
}
