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
    app_id: "miniapp-last-survivor",
    name: "LastSurvivor",
    description: "The button / tontine tension game where the last buyer takes the full jackpot.",
    icon: "⏱️",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-fogplay",
    name: "FogPlay",
    description: "Oracle-backed coin flips with direct GAS wagering and on-chain settlement.",
    icon: "🪙",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-gasbox",
    name: "GASBOX",
    description: "Provably fair blind-box economy with rapid-fire AA play and rare on-chain drops.",
    icon: "🎁",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-redenvelope",
    name: "Red Envelope",
    description: "Shareable on-chain GAS envelopes with equal-split or lucky-draw claim modes.",
    icon: "🧧",
    category: "social",
    entry_url: "",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-dailycheckin",
    name: "Daily Check-in",
    description: "One-tap streak rewards with GAS milestones and loyalty NFT badges.",
    icon: "📅",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-self-loan",
    name: "SelfLoan",
    description: "Borrow GAS instantly against future NEO staking rewards with zero liquidation risk.",
    icon: "🔁",
    category: "defi",
    entry_url: "",
    permissions: { payments: true },
  },
  {
    app_id: "miniapp-neo-pay",
    name: "NeoPay",
    description: "Recurring GAS or NEO streams with beneficiary claims and creator cancellation.",
    icon: "💸",
    category: "defi",
    entry_url: "",
    permissions: { payments: true },
  }
];

export const MINIAPP_REGISTRY: MiniAppInfo[] = MINIAPP_REGISTRY_RAW.map((app) =>
  withMiniAppCardAssets(forceManifestEntry(applyTemplate(app)))
);

export const FLAGSHIP_MINIAPP_IDS = MINIAPP_REGISTRY.map((app) => app.app_id);

export const MINIAPP_REGISTRY_MAP: Record<string, MiniAppInfo> = Object.fromEntries(
  MINIAPP_REGISTRY.map((app) => [app.app_id, app]),
);

export function getMiniApp(appId: string): MiniAppInfo | undefined {
  return MINIAPP_REGISTRY_MAP[appId];
}

export function getAllMiniApps(): MiniAppInfo[] {
  return MINIAPP_REGISTRY;
}
