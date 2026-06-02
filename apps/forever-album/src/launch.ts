import {
  getLaunchParam,
  type MiniAppLaunchContext,
} from "@shared/utils/launch-params";

export type ForeverAlbumPrivacyMode = "public" | "encrypted";

function normalizePrivacyMode(value: string): ForeverAlbumPrivacyMode {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "encrypted" ||
    normalized === "encrypt" ||
    normalized === "private" ||
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes"
  ) {
    return "encrypted";
  }
  return "public";
}

export function getForeverAlbumLaunchDefaults(
  launchContext: Pick<MiniAppLaunchContext, "params"> | null | undefined,
) {
  const privacy = normalizePrivacyMode(
    getLaunchParam(
      launchContext,
      ["privacy", "mode", "visibility", "encrypted", "isEncrypted"],
      "public",
    ),
  );

  return {
    privacy,
    isEncrypted: privacy === "encrypted",
  };
}
