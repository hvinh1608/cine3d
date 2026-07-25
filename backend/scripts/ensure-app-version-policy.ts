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
      latestVersion: '1.0.13',
      forceUpdate: false,
      message: 'Đã có bản CINE3D 1.0.13. Cập nhật để nhận thông báo bản mới và cải tiến ổn định.',
      storeUrl: `${downloadBase}/download`,
    },
    update: {
      latestVersion: '1.0.13',
      message: 'Đã có bản CINE3D 1.0.13. Cập nhật để nhận thông báo bản mới và cải tiến ổn định.',
      storeUrl: `${downloadBase}/download`,
    },
  });
  const ios = await prisma.appVersionPolicy.upsert({
    where: { platform: 'ios' },
    create: {
      platform: 'ios',
      minVersion: '1.0.0',
      latestVersion: '1.0.13',
      forceUpdate: false,
      message: 'Đã có bản CINE3D mới. Cập nhật để trải nghiệm ổn định hơn.',
      storeUrl: null,
    },
    update: {
      latestVersion: '1.0.13',
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
