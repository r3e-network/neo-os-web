import type { MiniAppInfo } from "../components/types";
import { withMiniAppCardAssets } from "./miniapp-media";
import { BUILTIN_APP_TEMPLATES } from "./templates/builtin-app-templates";

const MANIFEST_ENTRY_PREFIX = "mf://manifest?app=";

function applyTemplate(app: MiniAppInfo): MiniAppInfo {
  const t = BUILTIN_APP_TEMPLATES[app.app_id];
  if (t) {
    if (!app.detail_template) app.detail_template = t.detail_template;
    if (!app.operations) app.operations = t.operations;
  }
  return app;
}

function forceManifestEntry(app: MiniAppInfo): MiniAppInfo {
  return { ...app, entry_url: `${MANIFEST_ENTRY_PREFIX}${app.app_id}` };
}

const BUILTIN_APPS_RAW: MiniAppInfo[] = [
  {
    app_id: "builtin-lottery",
    name: "Neo Lottery",
    description: "Decentralized lottery with provably fair randomness",
    icon: "🎰",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "builtin-coin-flip",
    name: "Coin Flip",
    description: "50/50 coin flip - double your GAS",
    icon: "🪙",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "builtin-dice-game",
    name: "Dice Game",
    description: "Roll the dice and win up to 6x",
    icon: "🎲",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "builtin-prediction-market",
    name: "Prediction Market",
    description: "Trade on future outcomes",
    icon: "📊",
    category: "defi",
    entry_url: "",
    permissions: { payments: true, datafeed: true },
  },
  {
    app_id: "builtin-airdrop",
    name: "Airdrop Center",
    description: "Claim Multi-Chain Tokens & NFTs",
    icon: "🪂",
    category: "defi",
    entry_url: "",
    permissions: { payments: false },
  },
  {
    app_id: "builtin-dao-voting",
    name: "DAO Snapshot",
    description: "On-Chain Governance & Voting",
    icon: "⚖️",
    category: "governance",
    entry_url: "",
    permissions: { governance: true },
  },
  {
    app_id: "builtin-gacha",
    name: "On-Chain Gacha",
    description: "Blind Box Gamification",
    icon: "🎁",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  }
];

export const BUILTIN_APPS: MiniAppInfo[] = BUILTIN_APPS_RAW.map((app) =>
  withMiniAppCardAssets(forceManifestEntry(applyTemplate(app)))
);

export const BUILTIN_APPS_MAP: Record<string, MiniAppInfo> = Object.fromEntries(
  BUILTIN_APPS.map((app) => [app.app_id, app]),
);

export function getBuiltinApp(appId: string): MiniAppInfo | undefined {
  return BUILTIN_APPS_MAP[appId];
}

export function getAllBuiltinApps(): MiniAppInfo[] {
  return BUILTIN_APPS;
}