import { describe, expect, it } from "vitest";

import neoDidManifest from "../../oracle-neodid-console/neo-manifest.json";
import {
  consoleConfig,
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
    expect(result.status).toBe("Verification preview ready");
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
});
