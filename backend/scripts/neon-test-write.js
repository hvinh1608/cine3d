const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('vacuum...');
  await prisma.$executeRawUnsafe('VACUUM ANALYZE');
  await prisma.analyticsEvent.create({
    data: { name: 'page_view', path: '/healthcheck-space' },
  });
  console.log('insert ok', await prisma.analyticsEvent.count());
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
