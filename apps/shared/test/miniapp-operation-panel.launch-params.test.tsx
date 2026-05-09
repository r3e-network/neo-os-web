import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MiniAppOperationPanel } from "../components/MiniAppOperationPanel";
import { parseMiniAppLaunchContext } from "../utils/launch-params";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const labels: Record<string, string> = {
    claimPoolTitle: "Claim with OneGate",
    claimScannedKey: "Claim scanned reward",
    fieldRequired: "Required",
  };
  return labels[key] ?? key;
}

describe("MiniAppOperationPanel launch params", () => {
  it("maps OneGate QR key aliases into the hidden claimKey field", async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const launchContext = parseMiniAppLaunchContext(
      "https://onegate.space/app/23?key=ogv_test_alias_key&pool=pool-001&network=testnet",
      "miniapp-gas-lucky-pool",
    );

    render(
      <MiniAppOperationPanel
        operations={[
          {
            key: "claimPool",
            titleKey: "claimPoolTitle",
            actionKey: "claimScannedKey",
            actionMethod: "claimPool",
            fields: [
              {
                key: "claimKey",
                type: "text",
                labelKey: "claimKey",
                required: true,
                hidden: true,
              },
            ],
          },
        ]}
        t={t}
        state={{}}
        onAction={onAction}
        launchContext={launchContext}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Claim scanned reward",
    });
    expect((button as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(button);

    expect(onAction).toHaveBeenCalledWith("claimPool", {
      claimKey: "ogv_test_alias_key",
    });
  });
});
