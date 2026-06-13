import { describe, expect, it } from "vitest";

import oracleComputeManifest from "../../oracle-compute-lab/neo-manifest.json";
import {
  consoleConfig,
  manifest,
  messages,
} from "../../oracle-compute-lab/src/appConfig";

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

describe("Oracle Compute Lab config", () => {
  it("redacts raw input from sealed previews", () => {
    const result = consoleConfig.buildResult(
      {
        workflow: "risk-score",
        privacy: "sealed",
        input: "{\"secret\":\"do-not-leak\",\"asset\":\"GAS\"}",
      },
      t,
    );

    const payloadText = JSON.stringify(result.payload);

    expect(result.payload).toMatchObject({
      kind: "oracle.compute.request",
      workflow: "risk-score",
      privacy: "sealed",
      inputVisibility: "redacted",
      sealedInputRequired: true,
      dispatchReady: false,
      execution: "preview_only",
    });
    expect(result.payload).not.toHaveProperty("input");
    expect(payloadText).not.toContain("do-not-leak");
    expect(payloadText).toContain("inputDigest");
  });

  it("only includes raw input when the user explicitly chooses public mode", () => {
    const result = consoleConfig.buildResult(
      {
        workflow: "proof-check",
        privacy: "public",
        input: "{\"sample\":\"public-data\"}",
      },
      t,
    );

    expect(result.payload).toMatchObject({
      privacy: "public",
      input: "{\"sample\":\"public-data\"}",
      inputVisibility: "public",
    });
  });

  it("keeps standalone and manifest copy honest about preview-only compute", () => {
    const visibleCopy = [
      manifest.description,
      oracleComputeManifest.description,
      oracleComputeManifest.operation_panel.title,
      oracleComputeManifest.operation_panel.subtitle,
      ...oracleComputeManifest.operation_panel.operations.map(
        (operation) => operation.description,
      ),
      appMessages.panelDescription.en,
      appMessages.feature1Desc.en,
      appMessages.feature3Desc.en,
    ].join(" ");

    expect(visibleCopy).toMatch(/preview/i);
    expect(visibleCopy).not.toMatch(/dispatchers/i);
    expect(visibleCopy).not.toMatch(/confidential execution/i);
    expect(visibleCopy).not.toMatch(/verify the confidential package/i);
  });

  it("surfaces a JSON validity row and gates invalid input as input_required", () => {
    const valid = consoleConfig.buildResult(
      { workflow: "risk-score", privacy: "sealed", input: "{\"asset\":\"GAS\"}" },
      t,
    );
    const validRow = valid.rows.find((row) => row.label === t("inputValid"));
    expect(validRow?.value).toBe(t("yes"));
    expect(valid.payload.inputValid).toBe(true);
    expect(valid.payload.status).toBeUndefined();
    expect(valid.status).toBe("Compute preview ready");

    const invalid = consoleConfig.buildResult(
      { workflow: "risk-score", privacy: "sealed", input: "{not json" },
      t,
    );
    const invalidRow = invalid.rows.find((row) => row.label === t("inputValid"));
    expect(invalidRow?.value).toBe(t("no"));
    expect(invalid.payload.inputValid).toBe(false);
    // A malformed payload must NOT count as a success — the shared panel gates on
    // payload.status === "input_required".
    expect(invalid.payload.status).toBe("input_required");
    expect(invalid.status).toBe("Enter a valid JSON input payload");
  });

  it("renders localized workflow/privacy labels in the summary instead of raw enum values", () => {
    const result = consoleConfig.buildResult(
      { workflow: "risk-score", privacy: "sealed", input: "{}" },
      t,
    );
    // The summary must use the human labels ("Risk score", "Sealed"), never the
    // raw enum slugs ("risk-score", "sealed") that produced mixed-language zh.
    expect(result.summary).toBe("Risk score Sealed preview prepared");
    expect(result.summary).not.toContain("risk-score");
    const workflowRow = result.rows.find((row) => row.label === t("workflow"));
    expect(workflowRow?.value).toBe("Risk score");
  });
});
