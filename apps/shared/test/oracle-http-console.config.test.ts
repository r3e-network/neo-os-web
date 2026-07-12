import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  MAX_ORACLE_HTTP_BODY_BYTES,
  MORPHEUS_HTTP_ROUTE,
  consoleConfig,
  isValidJsonPath,
  manifest,
  messages,
  resolveOracleHttpEnvironment,
  validateOracleHttpBody,
  validateOracleHttpEndpoint,
  validateOracleHttpPath,
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

function appFile(file: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return path.join(appsRoot, "oracle-http-console", file);
}

describe("Oracle HTTP Console config", () => {
  it("uses the canonical Neo Soft green accent", () => {
    expect(manifest.theme?.accentColor).toBe("#16c784");
  });

  it("keeps the public manifest aligned with a local, wallet-free payload builder", () => {
    const publicManifest = JSON.parse(readFileSync(appFile("neo-manifest.json"), "utf8"));
    const packageJson = JSON.parse(readFileSync(appFile("package.json"), "utf8"));
    const main = readFileSync(appFile("src/main.tsx"), "utf8");

    expect(publicManifest.version).toBe("1.2.0");
    expect(packageJson.version).toBe("1.2.0");
    expect(publicManifest.permissions).toEqual([]);
    expect(publicManifest.features).toMatchObject({ stateless: true, offlineSupport: true });
    expect(publicManifest).not.toHaveProperty("stateSource");
    expect(publicManifest.operation_panel.operations).toEqual([]);
    expect(main).toContain("resolveOracleHttpEnvironment(ctx.launchContext.network)");
    expect(main).toContain('ctx.framework.actions.register("resetRequest"');
    expect(main).toContain('ctx.framework.actions.register("invalidateRequest"');
    expect(main).toContain('ctx.framework.actions.register("copyPayload"');
    expect(main).not.toContain("ensureWallet");
    expect(main).not.toContain("invoke(");
  });

  it("builds a ready preview from valid defaults without an input_required flag", () => {
    const result = consoleConfig.buildResult(defaults(), t);

    expect(result.status).toBe("Morpheus payload ready");
    expect(result.payload).toMatchObject({
      kind: "oracle.http.request",
      method: "GET",
      urlValid: true,
      route: MORPHEUS_HTTP_ROUTE,
      execution: "preview_only",
      dispatchReady: false,
      digestAlgorithm: "sha256-canonical-morpheus-draft-v1",
      morpheusPayload: {
        method: "GET",
        json_path: "status",
        target_chain: "neo_n3",
      },
    });
    // A successful preview must NOT carry the input_required marker, so the shared
    // ConsoleToolPanel treats it as a genuine success (toast + counter + digest).
    expect(result.payload.status).toBeUndefined();
    expect(result.payload.digest).toBeTruthy();
    expect(result.payload.previewId).toBe(result.payload.digest);
    expect(result.payload.digest).toMatch(/^0x[0-9a-f]{64}$/);
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
    expect(result.payload).not.toHaveProperty("digest");
    expect(result.payload).not.toHaveProperty("previewId");
  });

  it("never replaces missing caller input with a module-load network default", () => {
    const result = consoleConfig.buildResult({ method: "GET", network: "testnet" }, t);

    expect(result.payload).toMatchObject({
      status: "input_required",
      network: "testnet",
      url: "",
      urlValid: false,
      pathValid: false,
    });
    expect(result.payload).not.toHaveProperty("digest");
  });

  it("rejects URL parts the oracle lane cannot fetch as written", () => {
    expect(validateOracleHttpEndpoint("https://user:secret@example.com/data")).toMatchObject({ valid: false, errorKey: "httpUrlCredentialsBlocked" });
    expect(validateOracleHttpEndpoint("https://example.com/data#price")).toMatchObject({ valid: false, errorKey: "httpUrlFragmentBlocked" });
    for (const value of [
      "http://localhost:8080/data",
      "http://localhost./data",
      "http://api.local./data",
      "http://127.0.0.1/data",
      "http://10.0.0.7/data",
      "http://169.254.169.254/latest/meta-data",
      "http://192.168.1.20/data",
      "http://[::1]/data",
      "http://2130706433/data",
      "http://0x7f000001/data",
    ]) {
      expect(validateOracleHttpEndpoint(value), value).toMatchObject({ valid: false, errorKey: "httpUrlPrivateHostBlocked" });
    }
    expect(validateOracleHttpEndpoint("https://api.example.com/data?pair=NEO")).toMatchObject({ valid: true, errorKey: "" });
  });

  it("uses the same endpoint rejection reason in the built preview", () => {
    const result = consoleConfig.buildResult(
      { ...defaults(), url: "http://127.0.0.1/private" },
      t,
    );
    expect(result.payload.status).toBe("input_required");
    expect(result.status).toBe(t("httpUrlPrivateHostBlocked"));
  });

  it("omits the request body for GET and packages exact JSON for POST", () => {
    const getResult = consoleConfig.buildResult(
      { ...defaults(), method: "GET", body: "{\"ignored\":true}" },
      t,
    );
    expect(getResult.payload.morpheusPayload).not.toHaveProperty("body");
    expect(getResult.payload.morpheusPayload).not.toHaveProperty("headers");

    const body = "{\n  \"kept\": true\n}";
    const postResult = consoleConfig.buildResult(
      { ...defaults(), method: "POST", body },
      t,
    );
    expect(postResult.payload.morpheusPayload).toMatchObject({
      body,
      headers: { "content-type": "application/json" },
    });
  });

  it("blocks malformed or oversized POST bodies without affecting GET", () => {
    const malformed = consoleConfig.buildResult(
      { ...defaults(), method: "POST", body: "{not-json}" },
      t,
    );
    expect(malformed.payload.status).toBe("input_required");
    expect(malformed.payload.bodyValid).toBe(false);
    expect(malformed.status).toBe(t("httpBodyInvalidJson"));

    const oversizedBody = `\"${"x".repeat(MAX_ORACLE_HTTP_BODY_BYTES)}\"`;
    expect(validateOracleHttpBody("POST", oversizedBody)).toMatchObject({
      valid: false,
      errorKey: "httpBodyTooLarge",
    });
    expect(validateOracleHttpBody("GET", oversizedBody)).toMatchObject({ valid: true });
  });

  it("normalizes unsupported methods to GET before computing the draft digest", () => {
    const result = consoleConfig.buildResult(
      { ...defaults(), method: "DELETE", body: "must not be sent" },
      t,
    );
    expect(result.payload.method).toBe("GET");
    expect(result.payload.morpheusPayload).not.toHaveProperty("body");
  });

  it("normalizes familiar JSONPath notation to the dot path Morpheus executes", () => {
    expect(validateOracleHttpPath("status")).toEqual({ valid: true, normalizedPath: "status" });
    expect(validateOracleHttpPath("data.0.value")).toEqual({ valid: true, normalizedPath: "data.0.value" });
    expect(validateOracleHttpPath("$.status")).toEqual({ valid: true, normalizedPath: "status" });
    expect(validateOracleHttpPath("$.data[0].value")).toEqual({ valid: true, normalizedPath: "data.0.value" });
    expect(validateOracleHttpPath("$.data[000].value")).toEqual({ valid: true, normalizedPath: "data.0.value" });
    expect(isValidJsonPath("$.status")).toBe(true);
    expect(isValidJsonPath("$.data[0].value")).toBe(true);
    expect(isValidJsonPath("$..price")).toBe(false);
    expect(isValidJsonPath("$")).toBe(false);
    expect(isValidJsonPath("data.*.price")).toBe(false);
    expect(isValidJsonPath("$status")).toBe(false);
    expect(isValidJsonPath("status.")).toBe(false);
    expect(isValidJsonPath("$.a[")).toBe(false);
    expect(isValidJsonPath("$.a.")).toBe(false);
    expect(isValidJsonPath(`$.${"a".repeat(260)}`)).toBe(false);
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
    expect(result.status).toBe("Use a Morpheus dot path such as status or data.0.price");
  });

  it("shows a Path valid: Yes row on a clean default preview", () => {
    const result = consoleConfig.buildResult(defaults(), t);
    const pathRow = result.rows.find((row) => row.label === t("pathValid"));
    expect(pathRow?.value).toBe(t("yes"));
    expect(result.payload.pathValid).toBe(true);
    expect(result.payload.status).toBeUndefined();
  });

  it("binds the digest and seeded source to the selected Morpheus network", () => {
    const mainnet = consoleConfig.buildResult({ ...defaults(), network: "mainnet" }, t);
    const testnet = consoleConfig.buildResult({ ...defaults(), network: "testnet" }, t);
    const testnetEnvironment = resolveOracleHttpEnvironment("neo-n3-testnet");

    expect(testnetEnvironment.networkLabel).toBe("Morpheus Testnet");
    expect(testnetEnvironment.defaultUrl).toContain("/testnet/health");
    expect(mainnet.payload.network).toBe("mainnet");
    expect(testnet.payload.network).toBe("testnet");
    expect(testnet.payload.serviceBaseUrl).toContain("/testnet");
    expect(testnet.payload.digest).not.toBe(mainnet.payload.digest);
  });

  it("produces the same canonical digest for equivalent legacy and runtime paths", () => {
    const legacy = consoleConfig.buildResult({ ...defaults(), jsonPath: "$.data[0].value" }, t);
    const runtime = consoleConfig.buildResult({ ...defaults(), jsonPath: "data.0.value" }, t);
    expect(legacy.payload.digest).toBe(runtime.payload.digest);
    expect(legacy.payload.morpheusPayload).toEqual(runtime.payload.morpheusPayload);
  });
});
