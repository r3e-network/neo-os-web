import { describe, expect, it } from "vitest";

import { consoleConfig, manifest, messages } from "../../oracle-vrf-console/src/appConfig";

type LocalizedMessage = {
  en: string;
  zh: string;
};

const appMessages = messages as Record<string, LocalizedMessage>;

function t(key: string, params: Record<string, string | number> = {}) {
  let text = appMessages[key]?.en ?? key;
  for (const [param, value] of Object.entries(params)) {
    text = text.replace(`{${param}}`, String(value));
  }
  return text;
}

function defaults() {
  return Object.fromEntries(
    consoleConfig.fields.map((field) => [field.key, field.defaultValue ?? ""]),
  );
}

describe("Oracle VRF Console config", () => {
  it("hides the non-business Requests counter via the shared flag", () => {
    expect(consoleConfig.hideRequestCount).toBe(true);
    // The manifest also omits the statRequests stat, confirming the intent.
    const statKeys = (manifest.stats ?? []).map((stat) => stat.valueKey);
    expect(statKeys).not.toContain("requestCount");
  });

  it("uses the canonical green accent (no second accent hue)", () => {
    expect(manifest.theme?.accentColor).toBe("#16c784");
  });

  it("builds a clean request from valid defaults with no adjustment row", () => {
    const result = consoleConfig.buildResult(defaults(), t);
    expect(result.payload).toMatchObject({
      kind: "oracle.vrf.request",
      rounds: "1",
      roundsAdjusted: false,
    });
    expect(result.payload.digest).toBeTruthy();
    expect(
      result.rows.some((row) => row.label === t("roundsAdjusted")),
    ).toBe(false);
  });

  it("surfaces a Rounds adjusted row when an invalid round count is clamped", () => {
    for (const raw of ["0", "-5", "2.5", "abc"]) {
      const result = consoleConfig.buildResult({ ...defaults(), rounds: raw }, t);
      expect(result.payload.roundsAdjusted).toBe(true);
      const adjustedRow = result.rows.find(
        (row) => row.label === t("roundsAdjusted"),
      );
      expect(adjustedRow, `raw=${raw}`).toBeTruthy();
      expect(adjustedRow?.value).toContain(raw);
      expect(adjustedRow?.value).toContain("1");
    }
  });

  it("keeps a whole valid round count unadjusted", () => {
    const result = consoleConfig.buildResult({ ...defaults(), rounds: "3" }, t);
    expect(result.payload.rounds).toBe("3");
    expect(result.payload.roundsAdjusted).toBe(false);
  });

  it("returns input_required when consumer or salt is missing", () => {
    const result = consoleConfig.buildResult(
      { consumer: "", salt: "", rounds: "1", mode: "single-proof" },
      t,
    );
    expect(result.payload.status).toBe("input_required");
  });
});
