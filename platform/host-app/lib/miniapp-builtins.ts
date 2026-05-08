import type { MiniAppInfo } from "@/components/types";
import { withMiniAppCardAssets } from "./miniapp-media";
import { MINIAPP_TEMPLATES } from "./templates/miniapp-templates";

const MANIFEST_ENTRY_PREFIX = "mf://manifest?app=";
const TEMPLATE_OVERRIDE_IDS = new Set([
  "miniapp-self-loan",
  "miniapp-profitanchor",
  "miniapp-trustanchor",
  "miniapp-redenvelope",
]);

const DESCRIPTION_OVERRIDES: Record<string, string> = {
  "miniapp-self-loan":
    "Lock NEO to borrow GAS against future staking rewards. Collateral can follow ProfitAnchor's selected manual route while staying in SelfLoan custody.",
  "miniapp-profitanchor":
    "Manual 21-agent AA routing desk for profit-policy NEO voting. Operators rebalance between candidate agents and sync votes explicitly.",
  "miniapp-trustanchor":
    "Manual 21-agent AA routing desk for trust-policy NEO voting. Operators rebalance between candidate agents and sync votes explicitly.",
  "miniapp-redenvelope":
    "Claim-first GAS red envelopes for OneGate QR links, with a secondary creator flow for sending lucky packets.",
};

export const FLAGSHIP_MINIAPP_IDS: string[] = [
  "miniapp-last-survivor",
  "miniapp-fogplay",
  "miniapp-gasbox",
  "miniapp-redenvelope",
  "miniapp-dailycheckin",
  "miniapp-self-loan",
  "miniapp-profitanchor",
  "miniapp-trustanchor",
  "miniapp-neo-pay",
];

export function applyMiniAppReleaseDefaults(app: MiniAppInfo): MiniAppInfo {
  if (isFlagshipMiniApp(app.app_id)) return app;
  if (app.status === "disabled" || app.status === "pending") return app;
  return { ...app, status: "beta" };
}

export function applyBuiltInMiniAppDefaults(app: MiniAppInfo): MiniAppInfo {
  const next: MiniAppInfo = {
    ...app,
    entry_url: app.entry_url || `${MANIFEST_ENTRY_PREFIX}${encodeURIComponent(app.app_id)}`,
  };

  const template = MINIAPP_TEMPLATES[next.app_id];
  if (template) {
    const shouldOverride = TEMPLATE_OVERRIDE_IDS.has(next.app_id);
    if (shouldOverride || !next.detail_template) next.detail_template = template.detail_template;
    if (shouldOverride || !next.operations) next.operations = template.operations;
  }

  const description = DESCRIPTION_OVERRIDES[next.app_id];
  if (description) {
    next.description = description;
  }

  return withMiniAppCardAssets(applyMiniAppReleaseDefaults(next));
}

function isFlagshipMiniApp(appId: string): boolean {
  return FLAGSHIP_MINIAPP_IDS.includes(appId);
}
