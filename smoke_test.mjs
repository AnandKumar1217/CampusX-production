import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function findChromePath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' // Fallback to Edge if Chrome is missing
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  throw new Error("Could not find system Chrome or Edge executable.");
}

async function runSmokeTest() {
  const outDir = path.join(__dirname, 'docs', 'qa-evidence', 'antigravity-audit', 'runtime');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const chromePath = await findChromePath();
  console.log(`Using browser executable: ${chromePath}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set viewport to Standard iPhone size
  await page.setViewport({ width: 390, height: 844 });
  
  console.log('Navigating to Splash screen...');
  await page.goto('http://localhost:8082/qa/Splash', { timeout: 0 });
  
  // Give React Native Web a moment to fully render
  await new Promise(r => setTimeout(r, 20000));
  
  const screenshotPath = path.join(outDir, '01-splash-390x844.png');
  await page.screenshot({ path: screenshotPath });
  
  console.log(`Screenshot saved to ${screenshotPath}`);
  
  await browser.close();
  
  // Verify file size
  const stats = fs.statSync(screenshotPath);
  console.log(`File size: ${stats.size} bytes`);
}

runSmokeTest().catch(err => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
