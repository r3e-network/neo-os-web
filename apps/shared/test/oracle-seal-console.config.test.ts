import { describe, expect, it } from "vitest";

import { consoleConfig, manifest, messages } from "../../oracle-seal-console/src/appConfig";

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

describe("Oracle Seal Console config", () => {
  it("never echoes the sensitive payload into the result payload", () => {
    const result = consoleConfig.buildResult(
      { ...defaults(), payload: "{\"secret\":\"do-not-leak\"}" },
      t,
    );
    const payloadText = JSON.stringify(result.payload);
    expect(payloadText).not.toContain("do-not-leak");
    expect(result.payload).toHaveProperty("payloadDigest");
  });

  it("flags invalid JSON as input_required so the success signal stays honest", () => {
    const valid = consoleConfig.buildResult(
      { ...defaults(), payload: "{\"k\":1}" },
      t,
    );
    expect(valid.payload.payloadValid).toBe(true);
    expect(valid.payload.status).toBeUndefined();
    expect(valid.status).toBe("Envelope preview ready");

    const invalid = consoleConfig.buildResult(
      { ...defaults(), payload: "{not json" },
      t,
    );
    expect(invalid.payload.payloadValid).toBe(false);
    // The row says "No" AND the payload requests input again — no contradiction.
    expect(invalid.payload.status).toBe("input_required");
    const validRow = invalid.rows.find((row) => row.label === t("payloadValid"));
    expect(validRow?.value).toBe(t("no"));
  });

  it("renders an em-dash for an empty recipient and nulls it in the payload", () => {
    const result = consoleConfig.buildResult(
      { ...defaults(), recipient: "" },
      t,
    );
    const recipientRow = result.rows.find((row) => row.label === t("recipient"));
    expect(recipientRow?.value).toBe(t("digestPlaceholder"));
    expect(result.payload.recipient).toBeNull();
  });

  it("keeps a set recipient distinct from a blank one in the envelope checksum", () => {
    const withRecipient = consoleConfig.buildResult(
      { ...defaults(), recipient: "oracle-route-1", payload: "{}" },
      t,
    );
    const blank = consoleConfig.buildResult(
      { ...defaults(), recipient: "", payload: "{}" },
      t,
    );
    expect(withRecipient.payload.recipient).toBe("oracle-route-1");
    expect(withRecipient.payload.digest).not.toBe(blank.payload.digest);
  });

  it("keeps the in-app copy honest that the checksum is not encryption", () => {
    expect(appMessages.panelDescription.en).toMatch(/not encryption/i);
    expect(manifest.theme?.accentColor).toBeTruthy();
  });
});
