const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const APPS_ROOT = path.resolve(__dirname, '../../miniapps-uniapp/apps');
const PUBLIC_ROOT = path.resolve(__dirname, 'public/miniapps');

// All apps that need banner generation (complete list)
const apps = [
  // Phase 1 - original 10
  { id: 'flashloan', name: 'Flash Loan', color: '#8b5cf6' },
  { id: 'garden-of-neo', name: 'Garden of Neo', color: '#84cc16' },
  { id: 'gas-sponsor', name: 'Gas Sponsor', color: '#fb7185' },
  { id: 'gov-merc', name: 'Gov Merc', color: '#64748b' },
  { id: 'grant-share', name: 'GrantShare', color: '#06b6d4' },
  { id: 'graveyard', name: 'Graveyard', color: '#52525b' },
  { id: 'neoburger', name: 'NeoBurger', color: '#ea580c' },
  { id: 'neo-multisig', name: 'Neo Multisig', color: '#4f46e5' },
  { id: 'neo-ns', name: 'Neo Name Service', color: '#14b8a6' },
  { id: 'neo-news-today', name: 'Neo News Today', color: '#22c55e' },
  // Phase 2 - fix missing banners
  { id: 'burn-league', name: 'Burn League', color: '#f97316' },
  { id: 'coin-flip', name: 'Coin Flip', color: '#eab308' },
  { id: 'compound-capsule', name: 'Compound Capsule', color: '#8b5cf6' },
  { id: 'neo-swap', name: 'Neo Swap', color: '#00e599' },
  { id: 'self-loan', name: 'Self Loan', color: '#3b82f6' },
  { id: 'breakup-contract', name: 'Breakup Contract', color: '#ec4899' },
  { id: 'dev-tipping', name: 'Dev Tipping', color: '#f43f5e' },
  { id: 'ex-files', name: 'Ex Files', color: '#a855f7' },
  { id: 'red-envelope', name: 'Red Envelope', color: '#ef4444' },
  { id: 'on-chain-tarot', name: 'On-Chain Tarot', color: '#6366f1' },
  { id: 'time-capsule', name: 'Time Capsule', color: '#0ea5e9' },
  { id: 'candidate-vote', name: 'Candidate Vote', color: '#10b981' },
  { id: 'council-governance', name: 'Council Governance', color: '#6366f1' },
  { id: 'doomsday-clock', name: 'Doomsday Clock', color: '#dc2626' },
  { id: 'explorer', name: 'Neo Explorer', color: '#00e599' },
  { id: 'unbreakable-vault', name: 'Unbreakable Vault', color: '#78716c' },
];

(async () => {
  console.log('Launching browser for banner generation...');
  const browser = await chromium.launch();

  for (const app of apps) {
    console.log(`Processing ${app.id}...`);
    const appPath = path.join(APPS_ROOT, app.id);
    const staticPath = path.join(appPath, 'src/static');
    const pubStaticPath = path.join(PUBLIC_ROOT, app.id, 'static');

    // Check if banner already exists
    const existingBanner = path.join(pubStaticPath, 'banner.png');
    if (fs.existsSync(existingBanner)) {
      console.log(`  Banner already exists, skipping.`);
      continue;
    }

    // Ensure directories exist
    if (!fs.existsSync(staticPath)) fs.mkdirSync(staticPath, { recursive: true });
    if (!fs.existsSync(pubStaticPath)) fs.mkdirSync(pubStaticPath, { recursive: true });

    // Generate banner
    const pngBanner = path.join(staticPath, 'banner.png');
    console.log(`  Generating new banner.png`);
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 600 });
    await page.setContent(getBannerHtml(app.name, app.color));
    await page.screenshot({ path: pngBanner });
    await page.close();

    // Sync banner to public
    fs.copyFileSync(pngBanner, path.join(pubStaticPath, 'banner.png'));
    console.log(`  Banner generated and synced.`);
  }

  await browser.close();
  console.log('Banner generation complete.');
})();

function getBannerHtml(name, color) {
  // Premium banner with glassmorphism
  return `
    <html>
    <body style="margin:0;padding:0;">
      <div style="
        width:1200px;height:600px;
        background: linear-gradient(120deg, #0f172a, ${color} 150%);
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        font-family: ui-sans-serif, system-ui, sans-serif;
        color:white;
        position: relative;
        overflow: hidden;
      ">
        <!-- Abstract shape -->
        <div style="
            position: absolute; top: -100px; right: -100px; width: 600px; height: 600px;
            background: radial-gradient(circle, ${color}40 0%, transparent 70%);
            border-radius: 50%; opacity: 0.6; filter: blur(40px);
        "></div>
         <div style="
            position: absolute; bottom: -100px; left: -100px; width: 500px; height: 500px;
            background: radial-gradient(circle, #ffffff20 0%, transparent 70%);
            border-radius: 50%; opacity: 0.4; filter: blur(40px);
        "></div>

        <h1 style="font-size: 80px; font-weight: 800; margin: 0; z-index: 10; letter-spacing: -2px; 
           text-shadow: 0 4px 20px rgba(0,0,0,0.5);">
          ${name}
        </h1>
        <p style="font-size: 32px; font-weight: 500; margin-top: 16px; opacity: 0.9; z-index: 10;
           text-shadow: 0 2px 10px rgba(0,0,0,0.5);">
          neo.org/miniapps
        </p>
      </div>
    </body>
    </html>
  `;
}
