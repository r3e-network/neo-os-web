import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const buildSource = fs.readFileSync(
  path.resolve(__dirname, "../miniapp-build/index.ts"),
  "utf8",
);
const approveSource = fs.readFileSync(
  path.resolve(__dirname, "../miniapp-approve/index.ts"),
  "utf8",
);

describe("miniapp build/approve wiring", () => {
  it("checks build_mode in miniapp-build", () => {
    expect(buildSource).toContain("build_mode");
  });

  it("writes miniapp_approval_audit", () => {
    expect(approveSource).toContain("miniapp_approval_audit");
  });
});
