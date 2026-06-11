import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Contract test: every edge request path the SDK client builds must map to
 * an existing Supabase Edge function directory. This is what retired the 8
 * phantom endpoints (rng-request, datafeed-price, privacy-merkle-path,
 * privacy-relay, oracle-query, compute-execute, compute-jobs, compute-job)
 * — they pointed at functions that do not exist, so callers only ever saw
 * opaque 404s.
 */

const currentDir = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(join(currentDir, "../src/client.ts"), "utf8");
const edgeFunctionsDir = join(currentDir, "../../edge/functions");

const RETIRED_ENDPOINTS = [
  "rng-request",
  "datafeed-price",
  "privacy-merkle-path",
  "privacy-relay",
  "oracle-query",
  "compute-execute",
  "compute-jobs",
  "compute-job",
];

// Matches the first path segment of every quoted or template-literal request
// path in client.ts, e.g. "/pay-gas" or `/secrets-get?name=${...}`. The
// leading quote/backtick keeps regex literals (such as /\/$/) out of the set.
function extractEndpointNames(source: string): string[] {
  const pattern = /[`"']\/([a-z][a-z0-9-]*)/g;
  const names = new Set<string>();
  for (const match of source.matchAll(pattern)) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function listEdgeFunctionDirs(): Set<string> {
  return new Set(
    readdirSync(edgeFunctionsDir).filter((entry) =>
      statSync(join(edgeFunctionsDir, entry)).isDirectory(),
    ),
  );
}

describe("client.ts edge-endpoint contract", () => {
  const endpoints = extractEndpointNames(clientSource);

  it("extracts a plausible endpoint set (regex sanity guard)", () => {
    expect(endpoints.length).toBeGreaterThanOrEqual(25);
    expect(endpoints).toContain("pay-gas");
    expect(endpoints).toContain("vote-bneo");
    expect(endpoints).toContain("secrets-list");
    expect(endpoints).toContain("automation-trigger-executions");
  });

  it("references only paths with a matching platform/edge/functions/<dir>", () => {
    const available = listEdgeFunctionDirs();
    const missing = endpoints.filter((name) => !available.has(name));
    expect(missing).toEqual([]);
  });

  it("no longer references the retired TEE-gateway endpoints", () => {
    const referenced = endpoints.filter((name) =>
      RETIRED_ENDPOINTS.includes(name),
    );
    expect(referenced).toEqual([]);
  });
});
