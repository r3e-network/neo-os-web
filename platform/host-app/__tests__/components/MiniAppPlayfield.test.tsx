import React from "react";
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { MiniAppPlayfield } from "../../components/MiniAppPlayfield";
import type { MiniAppInfo } from "../../components/types";

const app: MiniAppInfo = {
  app_id: "miniapp-gasbox",
  name: "GASBox",
  description: "Gacha machine",
  icon: "G",
  category: "gaming",
  entry_url: "mf://manifest?app=miniapp-gasbox",
  contract_hash: "0x1234567890abcdef1234567890abcdef12345678",
  permissions: {},
};

describe("MiniAppPlayfield", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("uses the launch-context network for live contract reads", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        result: {
          state: "HALT",
          stack: [{ type: "Integer", value: "0" }],
        },
      }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(
      <MiniAppPlayfield
        app={app}
        launchContext={{
          appId: app.app_id,
          source: "url",
          operation: null,
          tab: null,
          network: "mainnet",
          params: { network: "mainnet" },
          keys: ["network"],
          hasParams: true,
          signature: "network=mainnet",
        }}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    for (const call of fetchMock.mock.calls) {
      const [, init] = call;
      const body = JSON.parse(String(init?.body || "{}")) as {
        network?: string;
      };
      expect(body.network).toBe("mainnet");
    }
  });
});
