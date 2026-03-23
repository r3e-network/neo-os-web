import type { MiniAppInfo } from "@/components/types";
import { withMiniAppCardAssets } from "./miniapp-media";
import { MINIAPP_TEMPLATES } from "./templates/miniapp-templates";

const MANIFEST_ENTRY_PREFIX = "mf://manifest?app=";

export const FLAGSHIP_MINIAPP_IDS: string[] = [
  "miniapp-last-survivor",
  "miniapp-fogplay",
  "miniapp-gasbox",
  "miniapp-redenvelope",
  "miniapp-dailycheckin",
  "miniapp-self-loan",
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
    if (!next.detail_template) next.detail_template = template.detail_template;
    if (!next.operations) next.operations = template.operations;
  }

  return withMiniAppCardAssets(applyMiniAppReleaseDefaults(next));
}

function isFlagshipMiniApp(appId: string): boolean {
  return FLAGSHIP_MINIAPP_IDS.includes(appId);
}
