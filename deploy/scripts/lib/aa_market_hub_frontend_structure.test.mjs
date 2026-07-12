import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("AA Market Hub exposes wallet-style market overview and guarded listing load", () => {
  const playArea = read("apps/aa-market-hub/src/PlayArea.tsx");
  const styles = read("apps/aa-market-hub/src/PlayArea.scss");
  const messages = read("apps/aa-market-hub/src/locale/messages.ts");

  assert.match(playArea, /from "@shared\/components-react\/v2\/OpenUiLite"/);
  assert.match(playArea, /from "@shared\/components-react\/v2\/PlayStage"/);
  assert.match(playArea, /OpenUiProvider/);
  assert.match(playArea, /PlayStage/);
  assert.match(playArea, /OpenUiPanel/);
  assert.match(playArea, /OpenUiTextField/);
  assert.match(playArea, /OpenUiNotice/);
  assert.ok(
    fs.existsSync(path.join(ROOT, "apps/aa-market-hub/public/market-escrow-desk.webp")),
    "AA market scene art must ship with the miniapp",
  );

  assert.match(playArea, /className="aa-market-play-area mx2 mx2-cat-defi"/);
  assert.match(playArea, /category="defi"/);
  assert.match(playArea, /className="aa-market-scene"/);
  assert.match(playArea, /className="aa-market-hero"/);
  assert.match(playArea, /className="aa-market-hero__image"/);
  assert.match(playArea, /src="\.\/market-escrow-desk\.webp"/);
  assert.match(playArea, /className="aa-market-layout"/);
  assert.match(playArea, /className="aa-market-drawer"/);
  assert.match(playArea, /drawerToggleLabel=\{t\("marketControls"\)\}/);
  assert.match(playArea, /drawer=\{\{ title: t\("marketControls"\), children: drawer \}\}/);

  assert.match(playArea, /void dispatch\("loadListings"\)/);
  assert.match(playArea, /void dispatch\("buySelected", backupOwner\.trim\(\) \|\| walletAddress\)/);
  assert.match(playArea, /void dispatch\("connectWallet"\)/);
  assert.match(playArea, /void dispatch\("cancelSelected"\)/);
  assert.match(playArea, /void dispatch\("recoverPending"\)/);
  assert.match(
    playArea,
    /:\s*canBuySelectedListing[\s\S]*?onClick: buy,[\s\S]*?disabled: busy/,
  );
  assert.match(styles, /\.aa-market-play-area \.mx2-stage__scene/);
  assert.match(styles, /\.aa-market-scene\s*\{/);
  assert.match(styles, /\.aa-market-drawer\s*\{/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /filter:\s*saturate/);
  assert.doesNotMatch(styles, /opacity:\s*0\.55/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/);

  assert.match(messages, /marketHeroTitle/);
  assert.match(messages, /marketRouteCopy/);
  assert.match(messages, /marketDeskTitle/);
  assert.match(messages, /marketMetricListings/);
  assert.match(messages, /buyEscrowExplainer/);
});
