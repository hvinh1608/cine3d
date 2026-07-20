import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const source = path.resolve(root, '../frontend/public/facebook-app-icon.png');

if (!fs.existsSync(source)) {
  throw new Error(`Missing source icon: ${source}`);
}

const size = 1024;
const background = '#09090B';

const sourceMeta = await sharp(source).metadata();
const sourceSize = Math.max(sourceMeta.width ?? size, sourceMeta.height ?? size);

// Adaptive icon safe zone is the center 66% circle.
const foregroundScale = 0.72;
const foregroundSize = Math.round(size * foregroundScale);

const foreground = await sharp(source)
  .resize(foregroundSize, foregroundSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const centeredForeground = await sharp({
  create: {
    width: size,
    height: size,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: foreground, gravity: 'center' }])
  .png()
  .toBuffer();

const appIcon = await sharp(source)
  .resize(size, size, { fit: 'cover' })
  .png()
  .toBuffer();

const solidBackground = await sharp({
  create: {
    width: size,
    height: size,
    channels: 3,
    background,
  },
})
  .png()
  .toBuffer();

// White silhouette for themed icons / notification badge.
const monochrome = await sharp(source)
  .resize(foregroundSize, foregroundSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .greyscale()
  .threshold(40)
  .negate()
  .png()
  .toBuffer();

const centeredMonochrome = await sharp({
  create: {
    width: size,
    height: size,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: monochrome, gravity: 'center' }])
  .png()
  .toBuffer();

const splashIcon = await sharp(source)
  .resize(Math.round(size * 0.42), Math.round(size * 0.42), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const writes = [
  ['icon.png', appIcon],
  ['android-icon-foreground.png', centeredForeground],
  ['android-icon-background.png', solidBackground],
  ['android-icon-monochrome.png', centeredMonochrome],
  ['splash-icon.png', splashIcon],
  ['favicon.png', await sharp(source).resize(48, 48, { fit: 'cover' }).png().toBuffer()],
];

for (const [name, buffer] of writes) {
  const target = path.join(assetsDir, name);
  await fs.promises.writeFile(target, buffer);
  console.log(`wrote ${name}`);
}
