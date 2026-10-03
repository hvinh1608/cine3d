const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function tableSizes() {
  return prisma.$queryRawUnsafe(`
    SELECT c.relname AS name,
           pg_size_pretty(pg_total_relation_size(c.oid)) AS size
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 20
  `);
}

async function main() {
  console.log('Before:', JSON.stringify(await tableSizes(), null, 2));
  const analytics = await prisma.analyticsEvent.count();
  const qr = await prisma.qrLoginSession.count();
  const cache = await prisma.cacheEntry.count();
  console.log({ analytics, qr, cache });

  await prisma.$executeRawUnsafe('TRUNCATE TABLE "AnalyticsEvent"');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "QrLoginSession"');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "CacheEntry"');
  await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  console.log('After:', JSON.stringify(await tableSizes(), null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
