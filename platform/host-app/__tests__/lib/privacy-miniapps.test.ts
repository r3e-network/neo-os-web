import fs from "fs";
import path from "path";
import { coerceMiniAppInfo } from "@/lib/miniapp";

const repoRoot = path.resolve(__dirname, "../../../..");
const appsRoot = path.join(repoRoot, "apps");

const MORPHEUS_CONFIDENTIAL_APPS = [
  "oracle-compute-lab",
  "oracle-seal-console",
  "oracle-neodid-console",
  "neodid-passport",
  "recovery-guardian",
  "graveyard",
  "private-transfer",
];

function readManifest(slug: string) {
  const manifestPath = path.join(appsRoot, slug, "neo-manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
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
