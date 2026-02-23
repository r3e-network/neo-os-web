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
    app_id: "miniapp-lottery",
    name: "Lottery",
    description: "Experience the thrill of provably fair lottery draws.",
    icon: "🎰",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-coinflip",
    name: "Coin Flip",
    description: "Classic 50/50 coin flip.",
    icon: "🪙",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-dicegame",
    name: "Dice Game",
    description: "Roll the dice and test your luck!",
    icon: "🎲",
    category: "gaming",
    entry_url: "",
    permissions: { payments: true, randomness: true },
  },
  {
    app_id: "miniapp-prediction-market",
    name: "Prediction Market",
    description: "Trade on the outcome of future events.",
    icon: "📊",
    category: "defi",
    entry_url: "",
    permissions: { payments: true, datafeed: true },
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