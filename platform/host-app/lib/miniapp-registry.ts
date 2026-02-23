import type { MiniAppInfo } from "../components/types";
import { withMiniAppCardAssets } from "./miniapp-media";
import { MINIAPP_TEMPLATES } from "./templates/miniapp-templates";

const MANIFEST_ENTRY_PREFIX = "mf://manifest?app=";

function applyTemplate(app: MiniAppInfo): MiniAppInfo {
  const t = MINIAPP_TEMPLATES[app.app_id];
  if (t) {
    if (!app.detail_template) app.detail_template = t.detail_template;
    if (!app.operations) app.operations = t.operations;
  }
  return app;
}

function forceManifestEntry(app: MiniAppInfo): MiniAppInfo {
  return { ...app, entry_url: `${MANIFEST_ENTRY_PREFIX}${app.app_id}` };
}

const MINIAPP_REGISTRY_RAW: MiniAppInfo[] = [
  {
    app_id: "miniapp-lottery",
    name: "Neo Lottery",
    description: "Decentralized lottery with provably fair randomness",
    icon: "🎰",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-coinflip",
    name: "Coin Flip",
    description: "50/50 coin flip - double your GAS",
    icon: "🪙",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-dicegame",
    name: "Dice Game",
    description: "Roll the dice and win up to 6x",
    icon: "🎲",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-predictionmarket",
    name: "Prediction Market",
    description: "Trade on future outcomes",
    icon: "📊",
    category: "defi",
    entry_url: "",
    permissions: { payments: true, datafeed: true },
  },
  {
    app_id: "miniapp-redenvelope",
    name: "Airdrop Center",
    description: "Claim Multi-Chain Tokens & NFTs",
    icon: "🪂",
    category: "defi",
    entry_url: "",
    permissions: { payments: false },
  },
  {
    app_id: "miniapp-secretvote",
    name: "DAO Snapshot",
    description: "On-Chain Governance & Voting",
    icon: "⚖️",
    category: "governance",
    entry_url: "",
    permissions: { governance: true },
  },
  {
    app_id: "miniapp-gacha",
    name: "On-Chain Gacha",
    description: "Blind Box Gamification",
    icon: "🎁",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  }
];

export const MINIAPP_REGISTRY: MiniAppInfo[] = MINIAPP_REGISTRY_RAW.map((app) =>
  withMiniAppCardAssets(forceManifestEntry(applyTemplate(app)))
);

export const MINIAPP_REGISTRY_MAP: Record<string, MiniAppInfo> = Object.fromEntries(
  MINIAPP_REGISTRY.map((app) => [app.app_id, app]),
);

export function getMiniApp(appId: string): MiniAppInfo | undefined {
  return MINIAPP_REGISTRY_MAP[appId];
}

export function getAllMiniApps(): MiniAppInfo[] {
  return MINIAPP_REGISTRY;
}
