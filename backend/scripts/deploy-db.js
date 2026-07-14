const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

function runPrisma(args, allowFailure = false) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['prisma', ...args], {
    encoding: 'utf8',
    env: process.env,
    stdio: allowFailure ? 'pipe' : 'inherit',
  });

  if (!allowFailure && result.status !== 0) process.exit(result.status || 1);
  return result;
}

const deploy = runPrisma(['migrate', 'deploy'], true);
if (deploy.status === 0) {
  process.stdout.write(deploy.stdout || '');
  process.exit(0);
}

const output = `${deploy.stdout || ''}\n${deploy.stderr || ''}`;
if (!output.includes('P3005')) {
  process.stderr.write(output);
  process.exit(deploy.status || 1);
}

console.log('Existing database detected. Aligning it once before recording the baseline migration.');
runPrisma(['db', 'push', '--skip-generate']);

// db push aligns an older, non-empty database with the complete current schema.
// Record every migration included in that schema so deploy does not try to run
// the same ALTER statements a second time.
const migrationsDir = join(__dirname, '..', 'prisma', 'migrations');
const migrations = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const migration of migrations) {
  runPrisma(['migrate', 'resolve', '--applied', migration]);
}
runPrisma(['migrate', 'deploy']);
