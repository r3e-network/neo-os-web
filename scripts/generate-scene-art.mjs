#!/usr/bin/env node
/**
 * Scene Art Generator
 * 
 * Generates AI scene backdrop images for miniapps using either:
 * 1. OpenAI gpt-image-2 (when OPENAI_API_KEY is set) — the user's preferred model
 * 2. Pollinations API (free fallback, no key required)
 * 
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/generate-scene-art.mjs [app-slug]
 *   node scripts/generate-scene-art.mjs --all
 *   node scripts/generate-scene-art.mjs dice-game flashloan fogplay
 *   OPENAI_IMAGE_MODEL=gpt-image-1 OPENAI_API_KEY=sk-... node scripts/generate-scene-art.mjs --all  # pin older model
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appsDir = path.join(repoRoot, "apps");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Allow the model to be overridden, defaulting to the user's requested model.
// gpt-image-2 is OpenAI's current state-of-the-art image model (text-to-image
// + image editing, precise text rendering, photorealism) — available via the
// /v1/images/generations endpoint. Set OPENAI_IMAGE_MODEL=gpt-image-1 to fall back.
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
// gpt-image-2 quality: low|medium|high|auto. medium is the sweet spot for warm
// scene backdrops (good fidelity, reasonable cost ~$0.04/img). Override via env.
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || "medium";
const USE_OPENAI = Boolean(OPENAI_API_KEY);

// Scene art prompts per app — each is business-relevant and visually rich
const SCENE_PROMPTS = {
  "dice-game": "beautiful golden 3D dice rolling on warm green casino felt table, bright warm lighting, game illustration",
  "on-chain-tarot": "mystical tarot cards spread on purple velvet cloth with golden trim, warm lighting, fortune telling",
  "red-envelope": "red gift envelope with gold seal floating, warm bright festive background, lunar new year celebration",
  "burn-league": "flaming cauldron with fire and embers, warm bright background, fantasy game competition arena",
  "last-survivor": "survival arena with countdown timer ring, warm dramatic lighting, last man standing game",
  "fogplay": "golden coin flipping in air with motion blur, warm bright background, coin toss game",
  "gasbox": "colorful slot machine with glowing screen, warm bright casino atmosphere, gachapon game",
  "daily-checkin": "daily check-in calendar with streak fire flame, warm bright motivational game",
  "flashloan": "abstract financial flow diagram with golden coins flowing through pipes, warm bright defi illustration",
  "gas-lucky-pool": "treasure chest overflowing with golden coins, warm bright defi vault, OneGate rewards",
  "neo-treasury": "financial treasury dashboard with NEO token and charts, warm bright defi analytics",
  "quadratic-funding": "community crowdfunding donation pool with matching chart, warm bright defi illustration",
  "gov-merc": "governance parliament voting chamber with ballot boxes, warm bright civic defi illustration",
  "milestone-escrow": "project milestone progress tracker with green checkmarks, warm bright defi illustration",
  "self-loan": "crypto loan calculator with collateral gauge meter, warm bright defi dashboard",
  "council-governance": "council proposal voting card with checkmark and gavel, warm bright governance",
  "neo-swap": "crypto token swap exchange with circular arrows, warm bright defi illustration",
  "neo-pay": "payment money stream with coins flowing through pipe, warm bright defi illustration",
  "neo-multisig": "multi-signature vault safe with multiple key holders, warm bright defi security",
  "neo-ns": "domain name registration search interface with globe, warm bright tool dashboard",
  "explorer": "blockchain explorer search interface with blocks and transactions, warm bright tool",
  "wallet-health": "wallet health diagnostic dashboard with gauge meter, warm bright tool",
  "oracle-price-console": "oracle data feed price ticker screen, warm bright futuristic tool",
  "oracle-vrf-console": "verifiable randomness generator with dice entropy, warm bright oracle futuristic",
  "oracle-http-console": "HTTP oracle data fetch network with globe, warm bright futuristic tool",
  "oracle-seal-console": "oracle seal notary stamp verification, warm bright official tool",
  "oracle-neodid-console": "digital identity verification card, warm bright futuristic tool",
  "oracle-compute-lab": "oracle compute lab data processing server, warm bright futuristic",
  "neo-x-bridge": "cross-chain bridge portal connecting two blockchain networks, warm bright",
  "automation-copilot": "automated trading trigger with lightning bolt, warm bright tool dashboard",
  "aa-session-key-lab": "account abstraction session key management, warm bright futuristic tool",
  "aa-account-lab": "account abstraction inspection terminal screen, warm bright futuristic",
  "aa-permissions-lab": "permission management with lock and unlock keys, warm bright security tool",
  "aa-relay-console": "relay transaction network broadcasting signal, warm bright futuristic tool",
  "aa-market-hub": "marketplace storefront trading accounts, warm bright tool marketplace",
  "neodid-passport": "digital identity passport card with hologram, warm bright futuristic",
  "private-transfer": "privacy shield lock encryption secure transfer, warm bright security tool",
  "profitanchor": "staking rewards vault with coins growing, warm bright defi staking",
  "trustanchor": "trust anchor staking node blockchain network, warm bright defi",
  "profitanchor-admin": "agent directory network nodes admin dashboard, warm bright governance",
  "trustanchor-admin": "trust anchor agent directory admin panel, warm bright governance",
  "recovery-guardian": "recovery guardian shield protection, warm bright security tool",
  "custom-anchor": "anchor staking node blockchain network, warm bright defi",
  "neo-message": "encrypted message envelope secure communication, warm bright privacy tool",
  "neo-sign-anything": "signing document with pen and wax seal, warm bright tool",
  "timestamp-proof": "timestamp clock proof verification notary, warm bright tool",
  "neo-convert": "cryptocurrency converter exchange arrows, warm bright tool",
  "gas-sponsor": "gas fuel station sponsorship pump, warm bright defi tool",
  "dev-tipping": "developer tipping coffee cup with coins, warm bright social",
  "breakup-contract": "broken torn contract paper scroll, warm bright social agreement",
  "graveyard": "tombstone graveyard memorial with flowers, warm serene peaceful",
  "forever-album": "photo album with memories polaroid style, warm bright nostalgic",
  "soulbound-certificate": "golden certificate with wax seal award, warm bright elegant",
  "memorial-shrine": "memorial candle shrine altar with flowers, warm serene peaceful",
  "time-capsule": "sealed vintage time capsule letter envelope, warm bright nostalgic",
  "unbreakable-vault": "heavy iron vault door with golden lock, warm bright fantasy game",
  "event-ticket-pass": "golden concert event ticket with holographic stripe, warm bright modern",
  "neo-pay-shared-example": "payment money stream with coins flowing, warm bright defi",
};

// Scene backdrops ship as near-lossless WebP to match the .webp references in
// each app's PlayArea.scss. Providers return JPEG/PNG bytes, so re-encode to
// WebP before writing and report the on-disk size.
async function writeSceneArt(outputPath, rawBuffer) {
  const webp = await sharp(rawBuffer)
    .webp({ quality: 82, effort: 5, smartSubsample: true })
    .toBuffer();
  fs.writeFileSync(outputPath, webp);
  return webp.length;
}

async function generateWithOpenAI(prompt, outputPath) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt: prompt + ", warm bright colors, high quality, clean composition, no text, no watermark",
      n: 1,
      size: "1024x1024",
      // gpt-image-2 supports quality + output_format. Request jpeg for a good
      // fidelity/cost balance; writeSceneArt re-encodes the bytes to WebP to
      // match each app's .webp scene-art references.
      quality: OPENAI_IMAGE_QUALITY,
      output_format: "jpeg",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  if (data.data?.[0]?.b64_json) {
    return writeSceneArt(outputPath, Buffer.from(data.data[0].b64_json, "base64"));
  } else if (data.data?.[0]?.url) {
    const imgResp = await fetch(data.data[0].url);
    const buf = Buffer.from(await imgResp.arrayBuffer());
    return writeSceneArt(outputPath, buf);
  }
  throw new Error("No image data in response");
}

async function generateWithPollinations(prompt, outputPath, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt + ", warm bright colors, high quality, clean composition"
  )}?width=512&height=512&nologo=true&seed=${seed}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Pollinations error: ${response.status}`);
  
  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length < 1000) throw new Error("Image too small (likely error page)");

  return writeSceneArt(outputPath, buf);
}

async function generateForApp(appSlug, seed = Math.floor(Math.random() * 10000)) {
  const prompt = SCENE_PROMPTS[appSlug];
  if (!prompt) {
    console.error(`  ${appSlug}: no prompt defined`);
    return false;
  }

  const appPublic = path.join(appsDir, appSlug, "public");
  if (!fs.existsSync(appPublic)) {
    fs.mkdirSync(appPublic, { recursive: true });
  }

  const outputPath = path.join(appPublic, `${appSlug}-scene-art.webp`);
  const filename = `${appSlug}-scene-art.webp`;

  process.stdout.write(`  ${appSlug}: `);

  try {
    let size;
    if (USE_OPENAI) {
      process.stdout.write(`(${OPENAI_IMAGE_MODEL}) `);
      size = await generateWithOpenAI(prompt, outputPath);
    } else {
      process.stdout.write("(pollinations) ");
      size = await generateWithPollinations(prompt, outputPath, seed);
    }
    console.log(`✓ ${(size / 1024).toFixed(0)}KB`);
    return true;
  } catch (err) {
    console.log(`✗ ${err.message}`);
    
    // If OpenAI fails, try Pollinations as fallback
    if (USE_OPENAI) {
      process.stdout.write(`  ${appSlug} (fallback pollinations): `);
      try {
        const size = await generateWithPollinations(prompt, outputPath, seed);
        console.log(`✓ ${(size / 1024).toFixed(0)}KB`);
        return true;
      } catch (err2) {
        console.log(`✗ ${err2.message}`);
      }
    }
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  console.log(`Scene Art Generator — ${USE_OPENAI ? `OpenAI ${OPENAI_IMAGE_MODEL}` : "Pollinations (free)"}`);
  console.log("");

  let appsToGenerate;
  if (args.includes("--all")) {
    appsToGenerate = Object.keys(SCENE_PROMPTS);
  } else if (args.length > 0) {
    appsToGenerate = args.filter(a => !a.startsWith("-"));
  } else {
    console.error("Usage: node generate-scene-art.mjs <app-slug> [--all]");
    process.exit(1);
  }

  let success = 0;
  let failed = 0;

  for (const app of appsToGenerate) {
    const ok = await generateForApp(app, 4000 + success);
    if (ok) success++;
    else failed++;
    
    // Rate limit: wait between requests
    if (USE_OPENAI) {
      await new Promise(r => setTimeout(r, 2000)); // 2s for OpenAI
    } else {
      await new Promise(r => setTimeout(r, 8000)); // 8s for Pollinations
    }
  }

  console.log("");
  console.log(`Done: ${success} generated, ${failed} failed`);
  
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
