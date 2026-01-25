import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.resolve(__dirname, "../../../../supabase/migrations/20260125000001_add_manual_publish_fields.sql"),
  "utf8",
);

describe("miniapp submissions manual publish migration", () => {
  it("adds manual publish columns", () => {
    expect(sql).toContain("entry_url");
    expect(sql).toContain("assets_selected");
    expect(sql).toContain("build_started_at");
    expect(sql).toContain("build_mode");
  });
});
