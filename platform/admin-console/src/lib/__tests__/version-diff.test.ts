import { describe, it, expect } from "vitest";
import { diffEntriesToCsv, diffVersionPayload, filterDiffEntries, summarizeDiff } from "@/lib/version-diff";

describe("version diff", () => {
  it("detects added, removed, and changed fields", () => {
    const before = {
      app_id: "miniapp-market",
      manifest: {
        name: "Market",
        tags: ["prediction"],
      },
      limits: {
        max_gas_per_tx: "10",
      },
    };

    const after = {
      app_id: "miniapp-market",
      manifest: {
        name: "Market V2",
        tags: ["prediction", "trading"],
      },
      permissions: {
        payments: true,
      },
    };

    const diff = diffVersionPayload(before, after);

    expect(diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "manifest.name", kind: "changed" }),
        expect.objectContaining({ path: "manifest.tags[1]", kind: "added" }),
        expect.objectContaining({ path: "limits", kind: "removed" }),
        expect.objectContaining({ path: "permissions", kind: "added" }),
      ]),
    );
  });

  it("returns empty diff for equal payloads", () => {
    const payload = { app_id: "miniapp-a", value: 1, nested: { ok: true } };
    expect(diffVersionPayload(payload, payload)).toEqual([]);
  });

  it("supports diff filtering and summary", () => {
    const before = {
      manifest: { name: "A", limits: { gas: 10 } },
      admin: { actor: "x" },
    };
    const after = {
      manifest: { name: "B", limits: { gas: 20 } },
      admin: { actor: "x", updated_at: "now" },
    };

    const all = diffVersionPayload(before, after);
    const filtered = filterDiffEntries(all, {
      includePaths: ["manifest"],
      excludePaths: ["manifest.limits"],
    });

    expect(filtered).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "manifest.name" }),
      ]),
    );
    expect(filtered.some((entry) => entry.path.startsWith("manifest.limits"))).toBe(false);

    const summary = summarizeDiff(all);
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.changed).toBeGreaterThan(0);
  });

  it("exports diff entries to CSV", () => {
    const csv = diffEntriesToCsv([
      { path: "manifest.name", kind: "changed", before: "A", after: "B" },
      { path: "manifest.tags[1]", kind: "added", after: "new" },
    ]);

    expect(csv).toContain("path,kind,before,after");
    expect(csv).toContain("manifest.name");
    expect(csv).toContain("changed");
  });
});
