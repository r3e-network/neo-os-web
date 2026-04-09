import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

test("nitro dockerfile uses pinned base images", () => {
  const dockerfile = fs.readFileSync(
    path.join(repoRoot, "deploy/docker/Dockerfile.service.nitro"),
    "utf8",
  );
  // Both builder and runtime stages must pin to a sha256 digest
  const fromLines = dockerfile.match(/^FROM\s+.+$/gm) || [];
  assert.ok(fromLines.length >= 2, "Expected at least 2 FROM lines");
  for (const line of fromLines) {
    assert.match(line, /@sha256:[0-9a-f]{64}/, `Unpinned base image: ${line}`);
  }
});

test("cluster issuer does not fall back to devops@miniapps.com", () => {
  const issuer = fs.readFileSync(
    path.join(repoRoot, "deploy/k8s/platform/cert-manager/cluster-issuer.yaml"),
    "utf8",
  );
  assert.doesNotMatch(issuer, /devops@miniapps\.com/);
});

test("configure_cert_manager.sh rejects devops@miniapps.com as invalid", () => {
  const script = fs.readFileSync(
    path.join(repoRoot, "deploy/scripts/configure_cert_manager.sh"),
    "utf8",
  );
  assert.match(script, /devops@miniapps\.com/);
});
