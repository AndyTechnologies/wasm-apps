import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/bump-versions.mjs <semver>');
  process.exit(1);
}

const rootDir = resolve(import.meta.dirname, '..');
const packages = ['packages/cli/package.json', 'packages/compiler/package.json', 'packages/linker/package.json', 'packages/types/package.json'];

let updated = 0;

for (const pkgPath of packages) {
  const fullPath = join(rootDir, pkgPath);
  if (!existsSync(fullPath)) {
    console.warn(`WARN: ${pkgPath} not found, skipping`);
    continue;
  }

  const content = readFileSync(fullPath, 'utf-8');
  let json;
  try {
    json = JSON.parse(content);
  } catch {
    console.warn(`WARN: ${pkgPath} is not valid JSON, skipping`);
    continue;
  }

  if (!Object.prototype.hasOwnProperty.call(json, 'version')) {
    console.warn(`WARN: ${pkgPath} has no version field, skipping`);
    continue;
  }

  json.version = version;
  writeFileSync(fullPath, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`Updated ${pkgPath} → ${version}`);
  updated++;
}

if (updated === 0) {
  console.error('ERROR: No package.json files were updated');
  process.exit(1);
}

execFileSync('git', ['add', ...packages], { cwd: rootDir, stdio: 'inherit' });
execFileSync('git', ['commit', '-m', `Release v${version}`], { cwd: rootDir, stdio: 'inherit' });
execFileSync('git', ['tag', `v${version}`], { cwd: rootDir, stdio: 'inherit' });

console.log(`\nCommitted as "Release v${version}" and tagged v${version}`);
console.log('Run `git push --tags` to publish.');
