import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const downloadBase = (process.env.CLIENT_URL || 'https://cine3d.id.vn').replace(/\/$/, '');

async function main() {
  const android = await prisma.appVersionPolicy.upsert({
    where: { platform: 'android' },
    create: {
      platform: 'android',
      minVersion: '1.0.0',
      latestVersion: '1.0.14',
      forceUpdate: false,
      message: 'Đã có bản CINE3D 1.0.14 với giao diện điện ảnh mới và trải nghiệm ổn định hơn.',
      storeUrl: `${downloadBase}/download`,
    },
    update: {
      latestVersion: '1.0.14',
      message: 'Đã có bản CINE3D 1.0.14 với giao diện điện ảnh mới và trải nghiệm ổn định hơn.',
      storeUrl: `${downloadBase}/download`,
    },
  });
  const ios = await prisma.appVersionPolicy.upsert({
    where: { platform: 'ios' },
    create: {
      platform: 'ios',
      minVersion: '1.0.0',
      latestVersion: '1.0.14',
      forceUpdate: false,
      message: 'Đã có bản CINE3D mới. Cập nhật để trải nghiệm ổn định hơn.',
      storeUrl: null,
    },
    update: {
      latestVersion: '1.0.14',
    },
  });
  console.log(JSON.stringify({ android, ios }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
