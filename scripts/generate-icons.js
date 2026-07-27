import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const svgPath = path.join(projectRoot, 'public', 'icons', 'mizan-mark.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

const targets = [
  // Web & PWA Icons
  { path: path.join(projectRoot, 'public', 'icons', 'mizan-192.png'), width: 192, height: 192 },
  { path: path.join(projectRoot, 'public', 'icons', 'mizan-512.png'), width: 512, height: 512 },
  { path: path.join(projectRoot, 'public', 'apple-touch-icon.png'), width: 180, height: 180 },
  
  // Android mipmap-mdpi (48x48)
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png'), width: 48, height: 48 },
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png'), width: 48, height: 48 },
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png'), width: 108, height: 108 },

  // Android mipmap-hdpi (72x72)
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png'), width: 72, height: 72 },
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png'), width: 72, height: 72 },
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png'), width: 162, height: 162 },

  // Android mipmap-xhdpi (96x96)
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png'), width: 96, height: 96 },
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png'), width: 96, height: 96 },
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png'), width: 216, height: 216 },

  // Android mipmap-xxhdpi (144x144)
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png'), width: 144, height: 144 },
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png'), width: 144, height: 144 },
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png'), width: 324, height: 324 },

  // Android mipmap-xxxhdpi (192x192)
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'), width: 192, height: 192 },
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png'), width: 192, height: 192 },
  { path: path.join(projectRoot, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png'), width: 432, height: 432 },
];

async function generateIcons() {
  console.log('Launching Playwright Chromium...');
  const browser = await chromium.launch();

  for (const target of targets) {
    const page = await browser.newPage({
      viewport: { width: target.width, height: target.height }
    });
    
    // Set SVG HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: ${target.width}px;
              height: ${target.height}px;
              overflow: hidden;
              background: transparent;
            }
            svg {
              width: ${target.width}px;
              height: ${target.height}px;
              display: block;
            }
          </style>
        </head>
        <body>
          ${svgContent}
        </body>
      </html>
    `;

    await page.setContent(htmlContent);
    
    // Ensure dir exists
    const dir = path.dirname(target.path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await page.screenshot({ path: target.path, omitBackground: true });
    console.log(`Generated: ${target.path} (${target.width}x${target.height})`);
    await page.close();
  }

  await browser.close();
  console.log('All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
