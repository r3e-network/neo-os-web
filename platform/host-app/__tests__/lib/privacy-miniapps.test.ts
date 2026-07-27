import fs from "fs";
import path from "path";
import { coerceMiniAppInfo } from "@/lib/miniapp";

// The manifests live in the app repos now; public/miniapp-manifests.json is the
// committed snapshot of them, kept current by scripts/refresh-manifest-snapshot.mjs.
const snapshot = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../public/miniapp-manifests.json"), "utf8"),
) as { manifests: Record<string, Record<string, unknown>> };

const MORPHEUS_CONFIDENTIAL_APPS = [
  "oracle-compute-lab",
  "oracle-seal-console",
  "oracle-neodid-console",
  "recovery-guardian",
  "private-transfer",
];

function readManifest(slug: string) {
  const manifest = snapshot.manifests[slug];
  if (!manifest) throw new Error(`no manifest for ${slug} in the snapshot`);
  return manifest;
}

describe("Morpheus confidential MiniApps", () => {
  it.each(MORPHEUS_CONFIDENTIAL_APPS)("%s declares confidential oracle compute permissions", (slug) => {
    const manifest = readManifest(slug);
    const app = coerceMiniAppInfo({
      app_id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      category: manifest.category,
      entry_url: `mf://manifest?app=${manifest.id}`,
      manifest,
    });

    expect(app).not.toBeNull();
    expect(app?.permissions.confidential).toBe(true);
    expect(app?.permissions.oracle).toBe(true);
    expect(app?.permissions.compute).toBe(true);
  });
});
