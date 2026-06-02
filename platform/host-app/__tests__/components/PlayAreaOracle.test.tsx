import React from "react";
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { OracleConsolePlayArea } from "../../components/playarea/PlayAreaOracle";
import type { MiniAppInfo } from "../../components/types";
import { storeSensitiveFrontendOperationValue } from "../../lib/miniapp-detail-helpers";

const baseApp: MiniAppInfo = {
  app_id: "miniapp-oracle-compute-lab",
  name: "Oracle Compute Lab",
  description: "Build Morpheus compute previews.",
  icon: "brain",
  category: "data",
  entry_url: "/miniapps/oracle-compute-lab/index.html",
  permissions: { oracle: true, compute: true, confidential: true },
};

const sealApp: MiniAppInfo = {
  app_id: "miniapp-oracle-seal-console",
  name: "Oracle Seal Console",
  description: "Seal sensitive oracle input.",
  icon: "lock",
  category: "data",
  entry_url: "/miniapps/oracle-seal-console/index.html",
  permissions: { oracle: true, confidential: true },
};

describe("OracleConsolePlayArea", () => {
  it("builds compute previews without falling back to HTTP or leaking sealed input", async () => {
    const { container } = render(
      <OracleConsolePlayArea
        app={baseApp}
        stats={[]}
        statsMap={{}}
        activity={null}
        loading={false}
        error={null}
        contractHash={null}
        network="testnet"
        launchContext={{
          appId: baseApp.app_id,
          source: "test",
          operation: "buildOraclePackage",
          tab: null,
          network: "testnet",
          params: { endpoint: "{\"secret\":\"host-do-not-leak\"}" },
          keys: ["endpoint"],
          hasParams: true,
          signature: "build-secret",
        }}
        onRefresh={jest.fn()}
      />,
    );

    await waitFor(() => {
      const result = container.querySelector("pre")?.textContent ?? "";
      expect(result).toContain("oracle.compute.request");
    });

    const pageText = container.textContent ?? "";
    const result = container.querySelector("pre")?.textContent ?? "";

    expect(result).toContain("input_digest");
    expect(result).toContain("\"input_visible\": false");
    expect(result).not.toContain("oracle.http.request");
    expect(result).not.toContain("host-do-not-leak");
    expect(pageText).not.toContain("host-do-not-leak");
  });

  it("consumes sensitive Seal refs without rendering plaintext payloads", async () => {
    const ref = storeSensitiveFrontendOperationValue(
      sealApp.app_id,
      "buildOraclePackage",
      "endpoint",
      "{\"secret\":\"seal-do-not-leak\"}",
    );

    const { container } = render(
      <OracleConsolePlayArea
        app={sealApp}
        stats={[]}
        statsMap={{}}
        activity={null}
        loading={false}
        error={null}
        contractHash={null}
        network="testnet"
        launchContext={{
          appId: sealApp.app_id,
          source: "test",
          operation: "buildOraclePackage",
          tab: null,
          network: "testnet",
          params: { endpoint_ref: ref },
          keys: ["endpoint_ref"],
          hasParams: true,
          signature: "seal-ref",
        }}
        onRefresh={jest.fn()}
      />,
    );

    await waitFor(() => {
      const result = container.querySelector("pre")?.textContent ?? "";
      expect(result).toContain("oracle.seal.request");
    });

    const pageText = container.textContent ?? "";
    const result = container.querySelector("pre")?.textContent ?? "";

    expect(result).toContain("payload_digest");
    expect(result).toContain("\"payload_visible\": false");
    expect(result).not.toContain("seal-do-not-leak");
    expect(pageText).not.toContain("seal-do-not-leak");
  });
});
