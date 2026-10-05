import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function findChromePath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Could not find Chrome.");
}

function loadPNG(filePath) {
  return new Promise((resolve, reject) => {
    const img = fs.createReadStream(filePath).pipe(new PNG()).on('parsed', () => resolve(img)).on('error', reject);
  });
}

async function runTest() {
  const chromePath = await findChromePath();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  
  // Actually, navigating to the app will try to load the splash, but then auto-redirect after 2500ms
  // Let's modify the app navigator to only render Splash just in case, but for now we'll rely on the 2.5s window
  // OR we can just inject a wildcard route so we can hit /qa/Splash.
  // Wait, I removed the wildcard routes! Let me just hit '/' and capture quickly.
  console.log("Navigating to http://localhost:8082...");
  await page.goto("http://localhost:8082", { timeout: 0 });
  
  // Wait for the animations to reach final state (around 1200ms) but before the redirect at 2500ms
  await new Promise(r => setTimeout(r, 1500));
  
  const screenshotPath = path.join(__dirname, 'splash_test.png');
  await page.screenshot({ path: screenshotPath });
  console.log("Captured splash_test.png");
  
  await browser.close();

  const refPath = path.join(__dirname, 'assets-reference', 'original', 'C Im', '01 splash.png');
  const img1 = await loadPNG(refPath);
  const img2 = await loadPNG(screenshotPath);

  const width = Math.min(img1.width, img2.width);
  const height = Math.min(img1.height, img2.height);

  const buf1 = new PNG({ width, height });
  const buf2 = new PNG({ width, height });
  PNG.bitblt(img1, buf1, 0, 0, width, height, 0, 0);
  PNG.bitblt(img2, buf2, 0, 0, width, height, 0, 0);

  const diff = new PNG({ width, height });
  const numDiffPixels = pixelmatch(buf1.data, buf2.data, diff.data, width, height, { threshold: 0.1 });
  const pct = ((numDiffPixels / (width * height)) * 100).toFixed(2);
  
  fs.writeFileSync(path.join(__dirname, 'splash_diff.png'), PNG.sync.write(diff));

  console.log(`Mismatch percentage: ${pct}%`);
}

runTest().catch(console.error);
