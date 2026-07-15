import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin shell style contract", () => {
  it("keeps an explicit sans-serif fallback in the shell font stack", () => {
    const css = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );

    // Re-pinned 2026-07-15 to the committed Neo v3 shell (488fa04ec): the
    // stylesheet now hardcodes the full fallback chain instead of routing
    // through the optional `--font-inter` variable. Guard intent is
    // unchanged — text must degrade to a sans-serif stack, never the browser
    // default serif, when the Inter webfont is unavailable.
    expect(css).toContain('font-family: "Inter", system-ui, sans-serif');
  });

  it("mounts the admin access key panel in the shell without local dark-mode chrome", () => {
    const layout = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/layout.tsx"),
      "utf8",
    );

    expect(layout).toContain("AdminAccessKeyPanel");
    expect(layout).not.toContain("dark:");
    expect(layout).not.toContain("selection:bg-neo");
    expect(layout).not.toContain("selection:text-neo");
  });

  it("keeps global scrollbar and shell defaults on the same light theme", () => {
    const css = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );

    expect(css).not.toContain("dark:");
    expect(css).not.toContain("bg-gradient-to-r");
  });
});
