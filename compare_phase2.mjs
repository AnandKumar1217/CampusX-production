import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAIRS = [
  { name: 'Splash', ref: 'assets-reference/original/C Im/01 splash.png' },
  { name: 'Login', ref: 'assets-reference/original/C Im/05 login.png' },
  { name: 'Home', ref: 'assets-reference/original/C Im/11 home.png' },
  { name: 'GroupPolls', ref: 'assets-reference/original/C Im/42 group polls.png' },
  { name: 'Game2048', ref: 'assets-reference/original/C Im/68_2048.png' }
];

const runtimeDir = path.join(__dirname, 'docs', 'qa-evidence', 'antigravity-audit', 'runtime');
const compDir = path.join(__dirname, 'docs', 'qa-evidence', 'antigravity-audit', 'comparisons');

if (!fs.existsSync(compDir)) {
  fs.mkdirSync(compDir, { recursive: true });
}

function loadPNG(filePath) {
  return new Promise((resolve, reject) => {
    const img = fs.createReadStream(filePath).pipe(new PNG()).on('parsed', () => resolve(img)).on('error', reject);
  });
}

async function run() {
  for (const p of PAIRS) {
    const runtimePath = path.join(runtimeDir, `${p.name}-390x844.png`);
    const refPath = path.join(__dirname, p.ref);

    if (!fs.existsSync(runtimePath) || !fs.existsSync(refPath)) {
      console.log(`Missing files for ${p.name}`);
      continue;
    }

    const img1 = await loadPNG(refPath);
    const img2 = await loadPNG(runtimePath);

    const width = Math.min(img1.width, img2.width);
    const height = Math.min(img1.height, img2.height);

    // Create normalized buffers if sizes differ
    const buf1 = new PNG({ width, height });
    const buf2 = new PNG({ width, height });
    PNG.bitblt(img1, buf1, 0, 0, width, height, 0, 0);
    PNG.bitblt(img2, buf2, 0, 0, width, height, 0, 0);

    const diff = new PNG({ width, height });
    const numDiffPixels = pixelmatch(buf1.data, buf2.data, diff.data, width, height, { threshold: 0.1 });

    const diffPath = path.join(compDir, `${p.name}-diff.png`);
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    
    const percentDiff = (numDiffPixels / (width * height)) * 100;
    console.log(`[${p.name}] Mismatched pixels: ${numDiffPixels} (${percentDiff.toFixed(2)}%) -> Saved diff to ${diffPath}`);
  }
}

run().catch(console.error);
