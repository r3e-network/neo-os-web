import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "/Users/jinghuiliao/git/r3e/neo-miniapps-platform/.workbuddy/artifacts/shots";
const URL = "http://localhost:5190/";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 460, height: 940, deviceScaleFactor: 2 });
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await sleep(3500);

// Click "免费试玩" (Free Play) to enter the actual game shell.
const started = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) =>
    /免费试玩|试玩|开始|play|start/i.test(b.textContent || ""),
  );
  if (btn) { btn.click(); return btn.textContent?.trim(); }
  return "no-free-play-btn";
});
console.log("start button:", started);
await sleep(5000);

// Now wait for the Phaser canvas.
let hasCanvas = false;
try {
  await page.waitForSelector("canvas", { timeout: 45000 });
  hasCanvas = true;
  console.log("canvas appeared");
} catch (e) {
  console.log("NO CANVAS after wait");
}

if (hasCanvas) {
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/sheep-lobby.png` });
  console.log("lobby shot done");

  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll(".sheep-a11y-controls button"));
    if (!btns.length) return "no-a11y-btns";
    const easy = btns.find((b) => /简单|easy/i.test(b.textContent || "")) || btns[0];
    easy.click();
    return easy.textContent?.trim() || "clicked";
  });
  console.log("clicked difficulty:", clicked);
  await sleep(4500);
  await page.screenshot({ path: `${OUT}/sheep-game.png` });
  console.log("game shot done");

  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll(".sheep-a11y-controls button"));
      const pick = btns.find((b) => /牌|pick|tile|选取/i.test(b.textContent || ""));
      if (pick) pick.click();
    });
    await sleep(650);
  }
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/sheep-game-play.png` });
  console.log("game-play shot done");
}

await browser.close();
console.log("done");
