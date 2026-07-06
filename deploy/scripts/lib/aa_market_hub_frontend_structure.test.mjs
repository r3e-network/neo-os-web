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

  assert.match(playArea, /from "@shared\/components-react\/v2"/);
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
  assert.match(playArea, /className="market-scene"/);
  assert.match(playArea, /className="market-scene__desk-card"/);
  assert.match(playArea, /src="\.\/market-escrow-desk\.webp"/);
  assert.match(playArea, /className="market-scene__route"/);
  assert.match(playArea, /className="market-scene__shelf"/);
  assert.match(playArea, /className="market-drawer"/);
  assert.match(playArea, /drawerToggleLabel=\{t\("marketBoardTitle"\)\}/);
  assert.match(playArea, /drawer=\{\{ title: t\("marketBoardTitle"\), children: drawer \}\}/);

  assert.match(playArea, /await dispatch\("loadListings", marketInput\.trim\(\)\)/);
  assert.match(playArea, /await dispatch\("buySelected", newBackupOwner\.trim\(\) \|\| walletAddress\)/);
  assert.match(playArea, /void dispatch\("connectWallet"\)/);
  assert.match(playArea, /void dispatch\("cancelSelected"\)/);
  assert.match(playArea, /disabled=\{!walletAddress \? isWalletConnecting : !marketInput\.trim\(\) \|\| isLoading\}/);
  assert.match(playArea, /disabled=\{!canBuySelectedListing \|\| busy\}/);
  assert.match(styles, /\.aa-market-play-area \.mx2-stage__scene/);
  assert.match(styles, /\.market-scene\s*\{[^}]*background:\s*transparent/s);
  assert.match(styles, /\.market-drawer\s*\{/);
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
