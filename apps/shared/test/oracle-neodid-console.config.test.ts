import { describe, expect, it } from "vitest";

import neoDidManifest from "../../oracle-neodid-console/neo-manifest.json";
import {
  consoleConfig,
  isValidCallback,
  isValidDid,
  manifest,
  messages,
} from "../../oracle-neodid-console/src/appConfig";

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

describe("Oracle NeoDID Console config", () => {
  it("ships usable defaults instead of building an empty verification request", () => {
    const defaults = Object.fromEntries(
      consoleConfig.fields.map((field) => [field.key, field.defaultValue ?? ""]),
    );
    const result = consoleConfig.buildResult(defaults, t);

    expect(result.payload).toMatchObject({
      kind: "oracle.neodid.verify",
      did: "did:neo:testnet:sample-user",
      claim: "profile.kyc",
      execution: "preview_only",
      dispatchReady: false,
    });
    expect(result.status).toBe("Verification request ready");
  });

  it("returns an explicit input-required state when DID or claim is missing", () => {
    const result = consoleConfig.buildResult(
      {
        did: "",
        provider: "neodid-registry",
        claim: "",
        callback: "",
      },
      t,
    );

    expect(result.payload).toEqual({
      kind: "oracle.neodid.verify",
      status: "input_required",
      required: ["did", "claim"],
      execution: "preview_only",
      dispatchReady: false,
    });
    expect(result.summary).toMatch(/Enter a DID and claim/);
  });

  it("declares explicit host params for NeoDID build and seal operations", () => {
    const [sealOperation, buildOperation] = neoDidManifest.operation_panel.operations;

    expect(manifest.description).toMatch(/Preview NeoDID/);
    expect(sealOperation.method).toBe("sealOracleRequest");
    expect(sealOperation.params.map((param) => param.name)).toEqual([
      "endpoint",
      "claim",
      "callback",
    ]);
    expect(sealOperation.params[0].sensitive).toBe(true);
    expect(buildOperation.method).toBe("buildOraclePackage");
    expect(buildOperation.params.map((param) => param.name)).toEqual([
      "endpoint",
      "claim",
      "callback",
    ]);
  });

  it("validates DID and callback formats", () => {
    expect(isValidDid("did:neo:testnet:sample-user")).toBe(true);
    expect(isValidDid("hello world")).toBe(false);
    expect(isValidDid("did:web:example.com")).toBe(false);
    // An empty callback is allowed (optional); a present one must be hash160.
    expect(isValidCallback("")).toBe(true);
    expect(isValidCallback("0x" + "a".repeat(40))).toBe(true);
    expect(isValidCallback("not-a-hash")).toBe(false);
  });

  it("flags a malformed DID as input_required with a validity row", () => {
    const result = consoleConfig.buildResult(
      { did: "hello world", provider: "neodid-registry", claim: "profile.kyc", callback: "" },
      t,
    );
    expect(result.payload).toMatchObject({
      status: "input_required",
      didValid: false,
    });
    const didRow = result.rows.find((row) => row.label === t("didValid"));
    expect(didRow?.value).toBe(t("no"));
    expect(result.status).toBe("Enter a valid did:neo identifier");
  });

  it("flags a malformed callback as input_required and surfaces a callback row", () => {
    const result = consoleConfig.buildResult(
      {
        did: "did:neo:testnet:sample-user",
        provider: "neodid-registry",
        claim: "profile.kyc",
        callback: "junk",
      },
      t,
    );
    expect(result.payload).toMatchObject({
      status: "input_required",
      callbackValid: false,
    });
    const callbackRow = result.rows.find((row) => row.label === t("callbackValid"));
    expect(callbackRow?.value).toBe(t("no"));
    expect(result.status).toBe("Callback must be a 0x hash160");
  });

  it("keeps a well-formed preview free of the input_required marker", () => {
    const result = consoleConfig.buildResult(
      {
        did: "did:neo:testnet:sample-user",
        provider: "neodid-registry",
        claim: "profile.kyc",
        callback: "0x" + "b".repeat(40),
      },
      t,
    );
    expect(result.payload.status).toBeUndefined();
    expect(result.payload.didValid).toBe(true);
    expect(result.payload.callbackValid).toBe(true);
    expect(result.status).toBe("Verification request ready");
  });
});
