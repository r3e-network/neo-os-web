import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20250123_miniapp_registry_view.sql"),
  "utf8"
);

describe("miniapp registry view", () => {
  it("does not reference miniapp_internal", () => {
    expect(sql.includes("miniapp_internal")).toBe(false);
  });
});
