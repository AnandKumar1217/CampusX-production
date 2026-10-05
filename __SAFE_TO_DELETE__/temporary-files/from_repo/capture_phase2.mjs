import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const SCREENS = [
  { name: 'Splash', route: 'qa/Splash' },
  { name: 'Login', route: 'qa/Login' },
  { name: 'Home', route: 'qa/Home' },
  { name: 'GroupPolls', route: 'qa/GroupPolls' },
  { name: 'Game2048', route: 'qa/Game2048' }
];

async function captureScreens() {
  const outDir = path.join(__dirname, 'docs', 'qa-evidence', 'antigravity-audit', 'runtime');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const chromePath = await findChromePath();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  
  for (const screen of SCREENS) {
    console.log(`Navigating to ${screen.name}...`);
    await page.goto(`http://localhost:8082/${screen.route}`, { timeout: 0 });
    
    // Wait for JS to render
    await new Promise(r => setTimeout(r, 6000));
    
    const screenshotPath = path.join(outDir, `${screen.name}-390x844.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved ${screenshotPath}`);
  }
  
  await browser.close();
}

captureScreens().catch(err => {
  console.error("Capture failed:", err);
  process.exit(1);
});
