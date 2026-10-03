const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.appVersionPolicy.updateMany({
  where: { platform: "android" },
  data: {
    latestVersion: "1.0.21",
    message:
      "Da co ban CINE3D 1.0.21 — chi con 1 nut Dang xuat. Cap nhat de tiep tuc.",
    storeUrl: "https://cine3d.id.vn/download",
  },
}).then((r) => {
  console.log(r);
  return p.$disconnect();
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
