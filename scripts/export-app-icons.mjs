import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const master =
  process.env.MIZAN_ICON_SRC ||
  path.join(root, "assets", "mizan-icon-master.png");

if (!fs.existsSync(master)) {
  console.error("Master icon missing:", master);
  process.exit(1);
}

const launcher = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

const foreground = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

async function writeLauncher(density, size) {
  const dir = path.join(root, "android/app/src/main/res", `mipmap-${density}`);
  const buf = await sharp(master)
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();
  await sharp(buf).toFile(path.join(dir, "ic_launcher.png"));
  await sharp(buf).toFile(path.join(dir, "ic_launcher_round.png"));
}

async function writeForeground(density, size) {
  const dir = path.join(root, "android/app/src/main/res", `mipmap-${density}`);
  // Keep mark inside adaptive safe zone (~66%) on transparent canvas
  const inset = Math.round(size * 0.66);
  const mark = await sharp(master)
    .resize(inset, inset, { fit: "cover" })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 75, g: 82, b: 199, alpha: 1 },
    },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(path.join(dir, "ic_launcher_foreground.png"));
}

async function writeWeb() {
  const iconsDir = path.join(root, "public/icons");
  fs.mkdirSync(iconsDir, { recursive: true });
  await sharp(master)
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, "mizan-512.png"));
  await sharp(master)
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, "mizan-192.png"));
  await sharp(master)
    .resize(180, 180)
    .png()
    .toFile(path.join(root, "public/apple-touch-icon.png"));
}

for (const [density, size] of Object.entries(launcher)) {
  await writeLauncher(density, size);
  console.log("launcher", density, size);
}
for (const [density, size] of Object.entries(foreground)) {
  await writeForeground(density, size);
  console.log("foreground", density, size);
}
await writeWeb();
console.log("web icons written");
