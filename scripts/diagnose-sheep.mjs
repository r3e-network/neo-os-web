import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:5190/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 460, height: 920, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await sleep(6000);

const info = await page.evaluate(() => {
  const shell = document.querySelector(".sheep-stage-shell");
  const stage = document.querySelector(".mx2-playstage");
  const tabs = Array.from(document.querySelectorAll(".mx2-playstage button, .mx2-playstage [role=tab]"))
    .map((b) => b.textContent?.trim());
  return {
    shellExists: !!shell,
    stageExists: !!stage,
    tabs: tabs.slice(0, 20),
    stageHtml: stage ? stage.outerHTML.slice(0, 1400) : null,
    allButtons: Array.from(document.querySelectorAll("button")).map((b) => b.textContent?.trim()).slice(0, 25),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
console.log("done");
