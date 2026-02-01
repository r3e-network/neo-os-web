import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { buildSubmissionPayload } from "../_shared/miniapps/submissions.ts";

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
    assertEquals(payload.manifest_hash, "hash");
    assertEquals(payload.build_mode, "platform");
  });
});
