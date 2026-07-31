const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

function runPrisma(args, allowFailure = false) {
  const prismaCli = require.resolve('prisma/build/index.js');
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    encoding: 'utf8',
    // Neon/PgBouncer can retain Prisma's session-level advisory lock after a
    // deploy process exits. Render runs one migration process at startup, so
    // disabling this lock avoids a permanent P1002 restart loop.
    env: { ...process.env, PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: '1' },
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
