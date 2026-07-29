import fs from "node:fs";
import path from "node:path";

/**
 * Audit fixes C-4 and H-4, previously asserted from the contract test suite by
 * reading host source across the repo boundary. The contracts live in
 * neo-os-contracts now and these are host concerns, so they are asserted here.
 *
 * C-4: every component that renders a miniapp iframe must declare a sandbox
 * that omits allow-same-origin. With it, the iframe reaches window.parent and
 * the host's auth tokens, which defeats the sandbox entirely.
 *
 * H-4: createHostSDK must refuse construction in a browser. Without the guard a
 * developer can bundle the host SDK - and its service credentials - into client
 * code.
 */
const hostRoot = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(hostRoot, relativePath), "utf8");
}

const IFRAME_RENDERERS = [
  "components/playarea/PlayAreaShared.tsx",
  "components/playarea/PlayAreaMedia.tsx",
] as const;

describe("miniapp iframe sandbox policy (audit C-4)", () => {
  it.each(IFRAME_RENDERERS)("%s declares a sandbox with allow-scripts", (file) => {
    expect(read(file)).toContain('sandbox="allow-scripts');
  });

  it.each(IFRAME_RENDERERS)("%s never grants allow-same-origin", (file) => {
    // Only the attribute itself matters - the comment above each iframe may
    // mention allow-same-origin while explaining why it is withheld.
    const sandboxAttrs = read(file).match(/sandbox="[^"]*"/g) ?? [];

    expect(sandboxAttrs.length).toBeGreaterThan(0);
    for (const attr of sandboxAttrs) {
      expect(attr).not.toContain("allow-same-origin");
    }
  });
});

describe("host SDK server-context guard (audit H-4)", () => {
  it("createHostSDK asserts it is not running in a browser", () => {
    const client = read("../sdk/src/client.ts");

    expect(client).toContain("assertHostSdkServerContext");
  });
});
