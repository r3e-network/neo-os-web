#!/usr/bin/env node
/**
 * Update contract addresses in README, .env, and manifests/manifest.json
 * Uses newly deployed addresses from contracts/build/remaining_miniapps.json
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MINIAPPS_DIR = path.join(ROOT, "miniapps-uniapp/apps");

// Contract name to miniapp folder mapping (for neo-manifest.json updates)
const CONTRACT_TO_FOLDER = {
  MiniAppLottery: "lottery",
  MiniAppCoinFlip: "coin-flip",
  MiniAppDiceGame: "dice-game",
  MiniAppScratchCard: "scratch-card",
  MiniAppGasSpin: "gas-spin",
  MiniAppSecretPoker: "secret-poker",
  MiniAppFogChess: "fog-chess",
  MiniAppPredictionMarket: "prediction-market",
  MiniAppFlashLoan: "flashloan",
  MiniAppPriceTicker: "price-ticker",
  MiniAppPricePredict: "price-predict",
  MiniAppMicroPredict: "micro-predict",
  MiniAppTurboOptions: "turbo-options",
  MiniAppILGuard: "il-guard",
  MiniAppAITrader: "ai-trader",
  MiniAppGridBot: "grid-bot",
  MiniAppRedEnvelope: "red-envelope",
  MiniAppGasCircle: "gas-circle",
  MiniAppSecretVote: "secret-vote",
  MiniAppNFTEvolve: "nft-evolve",
  MiniAppGovBooster: "gov-booster",
  MiniAppBridgeGuardian: "bridge-guardian",
  MiniAppGuardianPolicy: "guardian-policy",
  MiniAppNeoCrash: "neo-crash",
  MiniAppCandleWars: "candle-wars",
  MiniAppDutchAuction: "dutch-auction",
  MiniAppParasite: "parasite",
  MiniAppThroneOfGas: "throne-of-gas",
  MiniAppNoLossLottery: "no-loss-lottery",
  MiniAppDoomsdayClock: "doomsday-clock",
  MiniAppPayToView: "pay-to-view",
  MiniAppAlgoBattle: "algo-battle",
  MiniAppBountyHunter: "bounty-hunter",
  MiniAppCryptoRiddle: "crypto-riddle",
  MiniAppFogPuzzle: "fog-puzzle",
  MiniAppOnChainTarot: "on-chain-tarot",
  MiniAppPuzzleMining: "puzzle-mining",
  MiniAppScreamToEarn: "scream-to-earn",
  MiniAppWorldPiano: "world-piano",
  MiniAppBurnLeague: "burn-league",
  MiniAppCompoundCapsule: "compound-capsule",
  MiniAppDarkPool: "dark-pool",
  MiniAppMeltingAsset: "melting-asset",
  MiniAppQuantumSwap: "quantum-swap",
  MiniAppSelfLoan: "self-loan",
  MiniAppBreakupContract: "breakup-contract",
  MiniAppDevTipping: "dev-tipping",
  MiniAppExFiles: "ex-files",
  MiniAppGeoSpotlight: "geo-spotlight",
  MiniAppMasqueradeDAO: "masquerade-dao",
  MiniAppMillionPieceMap: "million-piece-map",
  MiniAppWhisperChain: "whisper-chain",
  MiniAppCanvas: "canvas",
  MiniAppGardenOfNeo: "garden-of-neo",
  MiniAppGraveyard: "graveyard",
  MiniAppNFTChimera: "nft-chimera",
  MiniAppSchrodingerNFT: "schrodinger-nft",
  MiniAppAISoulmate: "ai-soulmate",
  MiniAppDarkRadio: "dark-radio",
  MiniAppGovMerc: "gov-merc",
  MiniAppDeadSwitch: "dead-switch",
  MiniAppHeritageTrust: "heritage-trust",
  MiniAppTimeCapsule: "time-capsule",
  MiniAppUnbreakableVault: "unbreakable-vault",
  MiniAppZKBadge: "zk-badge",
  MiniAppCouncilGovernance: "council-governance",
  MiniAppCandidateVote: "candidate-vote",
  MiniAppGrantShare: "grant-share",
  MiniAppDailyCheckin: "daily-checkin",
  MiniAppNeoNS: "neo-ns",
  MiniAppNeoSwap: "neo-swap",
  MiniAppNeoburger: "neoburger",
  MiniAppGasSponsor: "gas-sponsor",
  MiniAppNeoTreasury: "neo-treasury",
  MiniAppExplorer: "explorer",
  MiniAppHallOfFame: "hall-of-fame",
};

// All deployed contract addresses (existing + new)
const ALL_ADDRESSES = {
  // Phase 1-5 (existing)
  MiniAppLottery: "0x3e330b4c396b40aa08d49912c0179319831b3a6e",
  MiniAppCoinFlip: "0xbd4c9203495048900e34cd9c4618c05994e86cc0",
  MiniAppDiceGame: "0xfacff9abd201dca86e6a63acfb5d60da278da8ea",
  MiniAppScratchCard: "0x2674ef3b4d8c006201d1e7e473316592f6cde5f2",
  MiniAppGasSpin: "0x19bcb0a50ddf5bf7cefbb47044cdb3ce4cb9e4cd",
  MiniAppSecretPoker: "0xa27348cc0a79c776699a028244250b4f3d6bbe0c",
  MiniAppFogChess: "0x23a44ca6643c104fbaa97daab65d5e53b3662b4a",
  MiniAppPredictionMarket: "0x64118096bd004a2bcb010f4371aba45121eca790",
  MiniAppFlashLoan: "0xee51e5b399f7727267b7d296ff34ec6bb9283131",
  MiniAppPriceTicker: "0x838bd5dd3d257a844fadddb5af2b9dac45e1d320",
  MiniAppPricePredict: "0x6317f97029b39f9211193085fe20dcf6500ec59d",
  MiniAppMicroPredict: "0x73264e59d8215e28485420bb33ba841ff6fb45f8",
  MiniAppTurboOptions: "0xbbe5a4d4272618b23b983c40e22d4b072e20f4bc",
  MiniAppILGuard: "0xd3557ccbb2ced2254f5862fbc784cd97cf746872",
  MiniAppAITrader: "0xc3356f394897e36b3903ea81d87717da8db98809",
  MiniAppGridBot: "0x0d9cfc40ac2ab58de449950725af9637e0884b28",
  MiniAppRedEnvelope: "0xf2649c2b6312d8c7b4982c0c597c9772a2595b1e",
  MiniAppGasCircle: "0x7736c8d1ff918f94d26adc688dac4d4bc084bd39",
  MiniAppSecretVote: "0x7763ce957515f6acef6d093376977ac6c1cbc47d",
  MiniAppNFTEvolve: "0xadd18a719d14d59c064244833cd2c812c79d6015",
  MiniAppGovBooster: "0xebabd9712f985afc0e5a4e24ed2fc4acb874796f",
  MiniAppBridgeGuardian: "0x2d03f3e4ff10e14ea94081e0c21e79e79c33f9e3",
  MiniAppGuardianPolicy: "0x893a774957244b83a0efed1d42771fe1e424cfec",
  MiniAppNeoCrash: "0x2e594e12b2896c135c3c8c80dbf2317fa56ceead",
  MiniAppCandleWars: "0x9dddba9357b93e75c29aaeaf37e7851aaaed6dbe",
  MiniAppDutchAuction: "0xb4394ee9eee040a9cce5450fceaaeabe83946410",
  MiniAppParasite: "0xe1726fbc4b6a5862eb2336ff32494be9f117563b",
  MiniAppThroneOfGas: "0xa89c3f6d82ad2803e1e576a2b441660c93316678",
  MiniAppNoLossLottery: "0x18cecd52efb529ac4e2827e9c9956c1bc450f154",
  MiniAppDoomsdayClock: "0xe4f386057d6308b83a5fd2e84bc3eb9149adc719",
  MiniAppPayToView: "0xfa920907126e63b5360a68fbf607294a82ef6266",
  // Phase 6+ (newly deployed)
  MiniAppAlgoBattle: "0xdeb2117b8db028e68e6acf2e9c67c26517d00a3e",
  MiniAppBountyHunter: "0x7b3929e7d7881c5929d29953d194c833178a0887",
  MiniAppCryptoRiddle: "0x35718d58fff23aed609df196d7954cbeb8ac3d7c",
  MiniAppFogPuzzle: "0xde0615f83fb3f0f80ef7b4e40b06e64b0d5ffa2a",
  MiniAppOnChainTarot: "0xc2bb26d21f357f125a0e49cbca7718b6aa5c3b1e",
  MiniAppPuzzleMining: "0x25409ffab1eb192b2313f86142aaa90f9fcfcbea",
  MiniAppScreamToEarn: "0xe94d5f6815b0574c7c685f1a460f3d05273b5e63",
  MiniAppWorldPiano: "0x946d0afa22c7661734288002fd7cb0dc6e765663",
  MiniAppBurnLeague: "0xf1aa73e2fb00664e8ef100dac083fc42be6aaf85",
  MiniAppCompoundCapsule: "0xba302bebace6c2bd0f610228b56bd3d3de07dbd7",
  MiniAppDarkPool: "0xf25a43e726c58ae5ec9468ff42caeaeeadd78128",
  MiniAppMeltingAsset: "0x964994b4ce9d77c7af303c6c762192d4184313ee",
  MiniAppQuantumSwap: "0x99fd1213d1d73181b84270ec3458bb46b9c4aab3",
  MiniAppSelfLoan: "0x5ed7d8c85f24f4aa16b328aca776e09be5241296",
  MiniAppBreakupContract: "0x84a3864028b7b71e9f420056e1eae2e3e3113a0c",
  MiniAppDevTipping: "0x38ec54ce12e9cbf041cc7e31534eccae0eaa38dc",
  MiniAppExFiles: "0xb45cd9f5869f75f3a7ac9e71587909262cbb96a5",
  MiniAppGeoSpotlight: "0x925959dc2360bd2fed7dd52ac3d29b76ff24c5dd",
  MiniAppMasqueradeDAO: "0x36873ae952147150e065ad2ba8d23731ffd00d5a",
  MiniAppMillionPieceMap: "0xdf787aaf8a70dd2612521de69f12c7bf5a8d0d6d",
  MiniAppWhisperChain: "0xbd51b0aee399ed00645c4a698c18806d2797fe64",
  MiniAppCanvas: "0x53f9c7b86fa2f8336839ef5073d964d644cbb46c",
  MiniAppGardenOfNeo: "0xdb52b284d97973b01fed431dd6d143a4d04d9fa7",
  MiniAppGraveyard: "0xe88938b2c2032483cf5edcdab7e4bde981e5fb24",
  MiniAppNFTChimera: "0x200996e599a2e3dba781438826a4f3622560dddd",
  MiniAppSchrodingerNFT: "0x43165f491aa0584d402f4b360d667f3e0e3293e7",
  MiniAppAISoulmate: "0x5df263b8d65fa5cc755b46acf8a7866f5dc05b92",
  MiniAppDarkRadio: "0x2652053354c3d2c574a0bc74e21a92a5dd94a42d",
  MiniAppGovMerc: "0x05d4ed2e60141043d6d20f5cde274704bd42c0dc",
  MiniAppDeadSwitch: "0x87dbc02162b5681dd4788061c1f411c7abce0e66",
  MiniAppHeritageTrust: "0xd59eea851cd8e5dd57efe80646ff53fa274600f8",
  MiniAppTimeCapsule: "0x119763e1402d7190728191d83c95c5b8e995abcd",
  MiniAppUnbreakableVault: "0xb60bf51f7fc9b7e0beeabfde0765d8ec9b895dd4",
  MiniAppZKBadge: "0x70915211c56fe3323b22043d3073765a7b633d3f",
  MiniAppCouncilGovernance: "0xec2f6de766fcbca43e71d5d2f451d9349f351c79",
};

// Update .env file
function updateEnvFile() {
  const envPath = path.join(ROOT, ".env");
  let content = fs.readFileSync(envPath, "utf-8");

  // Add new contract addresses section if not exists
  const newSection = `
# =============================================================================
# MiniApp Contract Addresses (Testnet) - Updated ${new Date().toISOString().split("T")[0]}
# =============================================================================
`;

  Object.entries(ALL_ADDRESSES).forEach(([name, address]) => {
    const envKey = `CONTRACT_${name.replace("MiniApp", "MINIAPP_").toUpperCase()}_ADDRESS`;
    const regex = new RegExp(`^${envKey}=.*$`, "m");

    if (regex.test(content)) {
      content = content.replace(regex, `${envKey}=${address}`);
    }
  });

  fs.writeFileSync(envPath, content);
  console.log("✅ Updated .env");
}

// Update manifests/manifest.json
function updateManifest() {
  const manifestPath = path.join(ROOT, "manifests/manifest.json");
  let content = fs.readFileSync(manifestPath, "utf-8");

  Object.entries(ALL_ADDRESSES).forEach(([name, address]) => {
    const key = `CONTRACT_${name.replace("MiniApp", "MINIAPP_").toUpperCase()}_ADDRESS`;
    const regex = new RegExp(`"${key}":\\s*"0x[a-fA-F0-9]+"`, "g");
    content = content.replace(regex, `"${key}": "${address}"`);
  });

  fs.writeFileSync(manifestPath, content);
  console.log("✅ Updated manifests/manifest.json");
}

// Update contracts/README.md
function updateReadme() {
  const readmePath = path.join(ROOT, "contracts/README.md");
  let content = fs.readFileSync(readmePath, "utf-8");

  Object.entries(ALL_ADDRESSES).forEach(([name, address]) => {
    // Match pattern: | ContractName | `0x...` | Status |
    const regex = new RegExp(`\\| ${name}\\s*\\| \`0x[a-fA-F0-9]+\``, "g");
    content = content.replace(regex, `| ${name.padEnd(23)} | \`${address}\``);
  });

  fs.writeFileSync(readmePath, content);
  console.log("✅ Updated contracts/README.md");
}

// Update neo-manifest.json files in miniapps-uniapp/apps
function updateNeoManifests() {
  let updated = 0;
  let skipped = 0;

  Object.entries(ALL_ADDRESSES).forEach(([contractName, address]) => {
    const folderName = CONTRACT_TO_FOLDER[contractName];
    if (!folderName) {
      return; // No mapping for this contract
    }

    const manifestPath = path.join(MINIAPPS_DIR, folderName, "neo-manifest.json");
    if (!fs.existsSync(manifestPath)) {
      return; // No neo-manifest.json for this miniapp
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

      // Update testnet address (all deployed addresses are testnet)
      if (manifest.contracts && manifest.contracts["neo-n3-testnet"]) {
        manifest.contracts["neo-n3-testnet"].address = address;
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
        updated++;
      }
    } catch (e) {
      console.warn(`⚠️  Failed to update ${folderName}: ${e.message}`);
      skipped++;
    }
  });

  console.log(`✅ Updated ${updated} neo-manifest.json files (${skipped} skipped)`);
}

// Main
console.log("🔧 Syncing contract addresses...\n");
updateEnvFile();
updateManifest();
updateReadme();
updateNeoManifests();
console.log("\n✅ All files updated!");
