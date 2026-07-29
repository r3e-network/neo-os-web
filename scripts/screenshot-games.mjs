import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = '/Users/jinghuiliao/git/r3e/neo-os-web/.workbuddy/artifacts/shots';
mkdirSync(OUT, { recursive: true });

async function clickEntry(page) {
  // Try multiple strategies to find the guest/free-trial entry button
  const strategies = [
    () => page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, [role="button"], [class*="btn"], [class*="Btn"], [class*="button"]')];
      const target = btns.find(b => b.textContent?.includes('免费') || b.textContent?.includes('Guest'));
      if (target) { target.click(); return `clicked: ${target.textContent.trim()}`; }
      return null;
    }),
    () => page.evaluate(() => {
      const all = [...document.querySelectorAll('*')];
      const el = all.find(e => e.children.length === 0 && 
        e.textContent?.trim().match(/^(免费|Guest|Play|Start)/));
      if (el) { el.click(); return `clicked text: ${el.textContent.trim()}`; }
      return null;
    }),
    async () => {
      // Last resort: click any green-colored button near center
      await page.mouse.click(240, 560);
      return 'fallback click at center-green area';
    },
  ];
  
  for (const fn of strategies) {
    const result = await fn();
    if (result) { console.log(`  Entry: ${result}`); return true; }
  }
  return false;
}

async function screenshotGame(url, name, extraWait = 3500) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 480, height: 860 });
  
  console.log(`[${name}] opening...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1200)); // let JS settle
  
  // Try entering the game
  const clicked = await clickEntry(page);
  if (clicked) {
    console.log(`[${name}] waiting ${extraWait}ms for scene render...`);
    await new Promise(r => setTimeout(r, extraWait));
  } else {
    console.log(`[${name}] no entry button found, waiting 4s for auto-render...`);
    await new Promise(r => setTimeout(r, 4000));
  }
  
  const path = join(OUT, `${name}-game.png`);
  await page.screenshot({ path, type: 'png' });
  const size = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
    canvas: !!document.querySelector('canvas'),
  }));
  console.log(`[${name}] saved -> ${path} (${size.w}x${size.h}, canvas=${size.canvas})`);
  await browser.close();
}

// Focus on the two problem games first
await screenshotGame('http://localhost:5181/', 'gas-lucky-pool');
await screenshotGame('http://localhost:5185/', 'pet-potion');
console.log('Done.');
