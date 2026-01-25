import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.resolve(__dirname, "../../../../supabase/migrations/20260125000002_update_miniapp_registry_view.sql"),
  "utf8"
);

describe("miniapp registry view", () => {
  it("unions internal apps", () => {
    expect(sql.includes("miniapp_internal")).toBe(true);
  });

  it("prefers assets_selected", () => {
    expect(sql).toContain("assets_selected");
  });

  it("uses entry_url for external apps", () => {
    expect(sql).toContain("entry_url");
  });
});
