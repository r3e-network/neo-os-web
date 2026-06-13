import { describe, expect, it } from "vitest";

import {
  consoleConfig,
  isValidJsonPath,
  manifest,
  messages,
} from "../../oracle-http-console/src/appConfig";

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

describe("Oracle HTTP Console config", () => {
  it("uses the canonical Neo Soft green accent", () => {
    expect(manifest.theme?.accentColor).toBe("#16c784");
  });

  it("builds a ready preview from valid defaults without an input_required flag", () => {
    const result = consoleConfig.buildResult(defaults(), t);

    expect(result.status).toBe("HTTP request ready");
    expect(result.payload).toMatchObject({
      kind: "oracle.http.request",
      method: "GET",
      urlValid: true,
    });
    // A successful preview must NOT carry the input_required marker, so the shared
    // ConsoleToolPanel treats it as a genuine success (toast + counter + digest).
    expect(result.payload.status).toBeUndefined();
    expect(result.payload.digest).toBeTruthy();
  });

  it("flags an invalid http(s) URL as input_required so success is gated", () => {
    const result = consoleConfig.buildResult(
      { ...defaults(), url: "ftp://example.com/data" },
      t,
    );

    // The validation row must read "No" and the payload must request input again,
    // matching the shared runPreview gate (ok = payload.status !== "input_required").
    expect(result.payload).toMatchObject({
      kind: "oracle.http.request",
      status: "input_required",
      urlValid: false,
    });
    const urlValidRow = result.rows.find((row) => row.label === t("urlValid"));
    expect(urlValidRow?.value).toBe(t("no"));
    expect(result.status).toBe("Enter a valid http(s) URL");
  });

  it("treats an unparseable URL as input_required", () => {
    const result = consoleConfig.buildResult(
      { ...defaults(), url: "not a url" },
      t,
    );

    expect(result.payload.status).toBe("input_required");
    expect(result.payload.urlValid).toBe(false);
  });

  it("omits the request body for GET while preserving it for POST", () => {
    const getResult = consoleConfig.buildResult(
      { ...defaults(), method: "GET", body: "{\"ignored\":true}" },
      t,
    );
    expect(getResult.payload.body).toBe("");

    const postResult = consoleConfig.buildResult(
      { ...defaults(), method: "POST", body: "{\"kept\":true}" },
      t,
    );
    expect(postResult.payload.body).toBe("{\"kept\":true}");
  });

  it("classifies syntactically valid and invalid JSON paths", () => {
    expect(isValidJsonPath("$.status")).toBe(true);
    expect(isValidJsonPath("$.data[0].value")).toBe(true);
    expect(isValidJsonPath("$..price")).toBe(true);
    expect(isValidJsonPath("$")).toBe(true);
    // Missing root, trailing dot, and unbalanced brackets are rejected.
    expect(isValidJsonPath("$status")).toBe(false);
    expect(isValidJsonPath("status.")).toBe(false);
    expect(isValidJsonPath("$.a[")).toBe(false);
    expect(isValidJsonPath("$.a.")).toBe(false);
  });

  it("gates an invalid JSON path as input_required with a Path valid row", () => {
    const result = consoleConfig.buildResult(
      { ...defaults(), jsonPath: "$status" },
      t,
    );
    expect(result.payload).toMatchObject({
      status: "input_required",
      pathValid: false,
      urlValid: true,
    });
    const pathRow = result.rows.find((row) => row.label === t("pathValid"));
    expect(pathRow?.value).toBe(t("no"));
    expect(result.status).toBe("Enter a valid JSON path (start with $)");
  });

  it("shows a Path valid: Yes row on a clean default preview", () => {
    const result = consoleConfig.buildResult(defaults(), t);
    const pathRow = result.rows.find((row) => row.label === t("pathValid"));
    expect(pathRow?.value).toBe(t("yes"));
    expect(result.payload.pathValid).toBe(true);
    expect(result.payload.status).toBeUndefined();
  });
});
