import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssets,
  assertClasses,
  assertDispatches,
  assertMessageKeys,
  assertModernTypography,
  assertPlayStage,
  exists,
  read,
} from "./frontend_structure_helpers.mjs";

test("NeoDID Passport renders a resource-led review desk with honest proof boundaries", () => {
  const playArea = read("apps/neodid-passport/src/PlayArea.tsx");
  const styles = read("apps/neodid-passport/src/PlayArea.scss");
  const main = read("apps/neodid-passport/src/main.tsx");
  const passport = read("apps/neodid-passport/src/passport.ts");
  const messages = read("apps/neodid-passport/src/appConfig.ts");
  const manifest = JSON.parse(read("apps/neodid-passport/neo-manifest.json"));

  assertPlayStage(playArea, "tool", "NeoDID Passport");
  assertClasses(playArea, [
    "neodid-passport-play-area",
    "did-scene",
    "did-identity-stage",
    "did-passport",
    "did-credential-lane",
    "did-template-deck",
    "did-assurance",
    "did-drawer",
    "did-evidence-list",
  ], "NeoDID Passport");
  assertDispatches(playArea, [
    "buildPassport",
    "signPassport",
    "retryPassportStorage",
    "copyPassportPayload",
    "resetPassport",
  ], "NeoDID Passport");
  assert.match(main, /signMessage\(canonicalize\(payload\)\)/);
  assert.match(main, /storageValueMatches/);
  assert.match(main, /ctx\.framework\.actions\.register\("retryPassportStorage"/);
  assert.doesNotMatch(main, /\.invoke\(|broadcast|sendTransaction/);
  assert.match(passport, /verification:\s*"not-performed"/);
  assert.match(passport, /wallet-adapter-specific-not-disclosed/);
  assert.match(passport, /MORPHEUS_PUBLIC_REGISTRY/);
  assertMessageKeys(messages, [
    "passportProductSubtitle",
    "localReviewBoundary",
    "selfAuthoredClaimNote",
    "assuranceTitle",
    "proofNotVerifiedHere",
    "retryStorageAction",
    "storageRecoveryRestored",
    "storageRecoveryFailed",
  ], "NeoDID Passport");
  assertAssets([
    "apps/neodid-passport/public/passport-desk.webp",
    "apps/neodid-passport/public/logo.webp",
    "apps/neodid-passport/public/banner.webp",
  ]);
  assert.equal(manifest.platform.transactions, false);
  assert.deepEqual(manifest.supported_networks, ["neo-n3-mainnet", "neo-n3-testnet"]);
  assert.ok(exists("apps/neodid-passport/PRODUCTION_STATUS.md"));
  assert.ok(exists("apps/neodid-passport/NETWORK_STATUS.md"));
  assert.ok(exists("apps/neodid-passport/ASSET_PROVENANCE.md"));
  assert.match(styles, /\.did-identity-stage__art\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(styles, /@media \(max-width:/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.doesNotMatch(styles, /backdrop-filter/);
  assert.doesNotMatch(playArea, /did-scene-art|CoinArt|emoji/);
  assertModernTypography(styles, "NeoDID Passport");
});
