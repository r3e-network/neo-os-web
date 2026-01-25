import { describe, it, expect } from "vitest";
import { buildSubmissionPayload } from "../_shared/miniapps/submissions";

const base = {
  gitUrl: "https://github.com/example/repo",
  gitInfo: { host: "github.com", owner: "example", name: "repo" },
  branch: "main",
  subfolder: "",
  commitInfo: { sha: "abc", message: "msg", author: "me", date: "now" },
  appId: "app-1",
  manifest: { app_id: "app-1" },
  manifestHash: "hash",
  assets: {},
  buildConfig: {},
};

describe("submission payload", () => {
  it("uses manifest_hash and build_mode", () => {
    const payload = buildSubmissionPayload({
      ...base,
      autoApproved: true,
    });
    expect(payload).toHaveProperty("manifest_hash", "hash");
    expect(payload).toHaveProperty("build_mode", "platform");
  });
});
