import { test, expect } from "@playwright/test";

function isTestnetTarget() {
  return String(
    process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK ||
      process.env.NEO_TARGET_NETWORK ||
      process.env.NEXT_PUBLIC_FLAGSHIP_NETWORK ||
      process.env.FLAGSHIP_NETWORK ||
      "",
  )
    .toLowerCase()
    .includes("testnet");
}

test.describe("MiniApp Detail", () => {
  test("should load LastSurvivor miniapp", async ({ page }) => {
    await page.goto("/miniapps/miniapp-last-survivor");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should load FogPlay miniapp", async ({ page }) => {
    await page.goto("/miniapps/miniapp-fogplay");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should show app info", async ({ page }) => {
    await page.goto("/miniapps/miniapp-last-survivor");
    await page.waitForTimeout(1000);
    // Check for any content loaded
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });

  test("should show mainnet contract domain binding", async ({ page }) => {
    await page.goto("/miniapps/miniapp-redenvelope");
    const domainBinding = page.getByTestId("contract-domain-binding");

    if (isTestnetTarget()) {
      await expect(domainBinding).toHaveCount(0);
      return;
    }

    await expect(domainBinding).toBeVisible();
    await expect(domainBinding).toContainText("Mainnet Domain");
    await expect(domainBinding).toContainText("redenvelope.miniapp.neo");
  });

  test("should resolve shared-mode runtime and invoke shared module operations with a mocked NeoLine wallet", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const calls: Array<Record<string, unknown>> = [];
      (window as any).__sharedInvokeCalls = calls;
      (window as any).NEOLineN3 = {
        Init: function MockNeoLine() {
          return {
            async getAccount() {
              return {
                address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
                label: "Mock Account",
              };
            },
            async getPublicKey() {
              return {
                address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
                publicKey:
                  "03407c24a382011c16be1597699cd6460f54e49c25098d4943fdf0192c80cb6917",
              };
            },
            async getBalance() {
              return [
                {
                  contract: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
                  symbol: "GAS",
                  amount: "123.45",
                },
                {
                  contract: "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",
                  symbol: "NEO",
                  amount: "42",
                },
              ];
            },
            async signMessage(params: { message: string }) {
              return {
                publicKey:
                  "03407c24a382011c16be1597699cd6460f54e49c25098d4943fdf0192c80cb6917",
                data: "mock-signature",
                salt: "mock-salt",
                message: params.message,
              };
            },
            async invoke(params: Record<string, unknown>) {
              calls.push(params);
              return {
                txid: "0xsharedtesttx",
                nodeUrl: "https://testnet2.neo.coz.io:443",
              };
            },
          };
        },
      };
    });

    await page.route("**/auth-wallet-nonce", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          nonce: "shared-mode-nonce",
          message: "Sign this shared-mode login challenge",
        }),
      });
    });

    await page.route("**/auth-wallet", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "playwright-wallet-token",
          user: { id: "wallet-user-1" },
        }),
      });
    });

    await page.route("**api.n3index.dev/testnet*", async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as {
        id?: number;
        jsonrpc?: string;
        method?: string;
        params?: unknown[];
      };

      if (body?.method !== "invokefunction") {
        await route.abort();
        return;
      }

      const [contractHash, operation, params] = body.params || [];
      const firstParamValue =
        Array.isArray(params) && params[0] && typeof params[0] === "object"
          ? (params[0] as { value?: string }).value
          : undefined;

      let stack;
      if (
        contractHash === "0x5b9a6d1ca5fdbc95d4307990551682a3b7a1d5d6" &&
        operation === "getInstance" &&
        firstParamValue === "neopay:testnet:default"
      ) {
        stack = [
          {
            type: "Struct",
            value: [
              {
                type: "ByteString",
                value: Buffer.from("neopay:testnet:default").toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from("miniapp-neo-pay").toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from("recipe.payment_streams.v1").toString(
                  "base64",
                ),
              },
              {
                type: "ByteString",
                value: Buffer.from("1.0.0").toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from("shared").toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from(
                  "6d065ef6dd91469cb1c90c41e574380613f43738",
                  "hex",
                )
                  .reverse()
                  .toString("base64"),
              },
              { type: "ByteString", value: "" },
              {
                type: "ByteString",
                value: Buffer.from(
                  "6d065ef6dd91469cb1c90c41e574380613f43738",
                  "hex",
                )
                  .reverse()
                  .toString("base64"),
              },
              { type: "ByteString", value: "" },
              {
                type: "ByteString",
                value: Buffer.from(
                  JSON.stringify({
                    vault: {
                      module_id: "module.funding_vault",
                      version: "1.0.0",
                    },
                    stream: {
                      module_id: "module.stream_vesting",
                      version: "1.0.0",
                    },
                  }),
                ).toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from("ab".repeat(32), "hex").toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from("miniapp-neo-pay@2.0.0").toString("base64"),
              },
              { type: "Integer", value: "1" },
              { type: "Boolean", value: false },
              { type: "Integer", value: "1774597315173" },
            ],
          },
        ];
      } else if (
        contractHash === "0xe22bc8072f616974a64c0da1dfda845945d4215f" &&
        operation === "getRecipe" &&
        firstParamValue === "recipe.payment_streams.v1"
      ) {
        stack = [
          {
            type: "Struct",
            value: [
              {
                type: "ByteString",
                value: Buffer.from("recipe.payment_streams.v1").toString(
                  "base64",
                ),
              },
              {
                type: "ByteString",
                value: Buffer.from("1.0.0").toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from(
                  JSON.stringify([{ binding: "vault" }, { binding: "stream" }]),
                ).toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from(
                  JSON.stringify({ required: ["escrow_assets"] }),
                ).toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from(
                  JSON.stringify({ actions: ["createStream"] }),
                ).toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from("shared").toString("base64"),
              },
              { type: "ByteString", value: "" },
              {
                type: "ByteString",
                value: Buffer.from(
                  JSON.stringify({ app_id: "miniapp-neo-pay" }),
                ).toString("base64"),
              },
              { type: "Boolean", value: true },
            ],
          },
        ];
      } else if (
        contractHash === "0x7666a46644dca58e8c3b308b34e83db440e04991" &&
        operation === "getModule" &&
        firstParamValue === "module.funding_vault"
      ) {
        stack = [
          {
            type: "Struct",
            value: [
              {
                type: "ByteString",
                value: Buffer.from("module.funding_vault").toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from("1.0.0").toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from(
                  "958bccb2ec9292461977ef1d2f1222d4e7861537",
                  "hex",
                )
                  .reverse()
                  .toString("base64"),
              },
              { type: "ByteString", value: "" },
              { type: "ByteString", value: "" },
              {
                type: "ByteString",
                value: Buffer.from("custody").toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from(
                  JSON.stringify({ accepted_assets: ["NEO", "GAS"] }),
                ).toString("base64"),
              },
              { type: "Boolean", value: true },
            ],
          },
        ];
      } else if (
        contractHash === "0x7666a46644dca58e8c3b308b34e83db440e04991" &&
        operation === "getModule" &&
        firstParamValue === "module.stream_vesting"
      ) {
        stack = [
          {
            type: "Struct",
            value: [
              {
                type: "ByteString",
                value: Buffer.from("module.stream_vesting").toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from("1.0.0").toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from(
                  "4fa6544b133457b561e4f9db0248483eca3d33cf",
                  "hex",
                )
                  .reverse()
                  .toString("base64"),
              },
              { type: "ByteString", value: "" },
              { type: "ByteString", value: "" },
              {
                type: "ByteString",
                value: Buffer.from("payments").toString("base64"),
              },
              {
                type: "ByteString",
                value: Buffer.from(
                  JSON.stringify({ recipe: "recipe.payment_streams.v1" }),
                ).toString("base64"),
              },
              { type: "Boolean", value: true },
            ],
          },
        ];
      } else {
        await route.abort();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id ?? 1,
          result: {
            script: "",
            state: "HALT",
            gasconsumed: "1",
            stack,
          },
        }),
      });
    });

    await page.goto("/miniapps/miniapp-neo-pay-shared-example");
    const actionPanel = page.getByTestId("miniapp-actions");
    if (!isTestnetTarget()) {
      const unavailableMessages = actionPanel.getByText(
        /not deployed or enabled on neo n3 mainnet/i,
      );
      expect(await unavailableMessages.count()).toBeGreaterThan(0);
      return;
    }

    await expect(
      actionPanel.getByRole("heading", { name: "Shared Runtime", exact: true }),
    ).toBeVisible();
    await expect(
      actionPanel.getByText("recipe.payment_streams.v1@1.0.0"),
    ).toBeVisible();
    await expect(
      actionPanel.getByText("module.stream_vesting@1.0.0"),
    ).toBeVisible();

    await page.getByRole("button", { name: /log in \/ sign up/i }).click();
    await page.getByRole("button", { name: "NeoLine" }).click();

    await expect(page.getByText(/123.45 GAS/i)).toBeVisible();

    await actionPanel
      .getByLabel("Beneficiary Address")
      .fill("NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX");
    await actionPanel.getByLabel("Total Amount").fill("20");
    await actionPanel.getByLabel("Release Per Interval").fill("1.5");
    await actionPanel.getByLabel("Stream Name").fill("Monthly payroll stream");
    await actionPanel.getByLabel("Notes").fill("Optional context");

    await actionPanel
      .locator("button.w-full")
      .filter({ hasText: "Create Stream" })
      .click();

    await page.waitForFunction(
      () =>
        Array.isArray((window as any).__sharedInvokeCalls) &&
        (window as any).__sharedInvokeCalls.length === 1,
    );

    const calls = await page.evaluate(
      () => (window as any).__sharedInvokeCalls,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      scriptHash: "0x4fa6544b133457b561e4f9db0248483eca3d33cf",
      operation: "createStream",
    });
  });
});
