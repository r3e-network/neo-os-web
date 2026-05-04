describe("shared-mode runtime resolver", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("resolves shared-mode instance, recipe, and module bindings", async () => {
    const invokeRead = jest.fn()
      .mockResolvedValueOnce({
        stack: [
          {
            type: "Struct",
            value: [
              { type: "ByteString", value: Buffer.from("neopay:testnet:default").toString("base64") },
              { type: "ByteString", value: Buffer.from("miniapp-neo-pay").toString("base64") },
              { type: "ByteString", value: Buffer.from("recipe.payment_streams.v1").toString("base64") },
              { type: "ByteString", value: Buffer.from("1.0.0").toString("base64") },
              { type: "ByteString", value: Buffer.from("shared").toString("base64") },
              { type: "ByteString", value: Buffer.from("6d065ef6dd91469cb1c90c41e574380613f43738", "hex").reverse().toString("base64") },
              { type: "ByteString", value: "" },
              { type: "ByteString", value: Buffer.from("6d065ef6dd91469cb1c90c41e574380613f43738", "hex").reverse().toString("base64") },
              { type: "ByteString", value: "" },
              { type: "ByteString", value: Buffer.from(JSON.stringify({
                vault: { module_id: "module.funding_vault", version: "1.0.0" },
                stream: { module_id: "module.stream_vesting", version: "1.0.0" },
              })).toString("base64") },
              { type: "ByteString", value: Buffer.from("ab".repeat(32), "hex").toString("base64") },
              { type: "ByteString", value: Buffer.from("miniapp-neo-pay@2.0.0").toString("base64") },
              { type: "Integer", value: "1" },
              { type: "Boolean", value: false },
              { type: "Integer", value: "1774597315173" },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        stack: [
          {
            type: "Struct",
            value: [
              { type: "ByteString", value: Buffer.from("recipe.payment_streams.v1").toString("base64") },
              { type: "ByteString", value: Buffer.from("1.0.0").toString("base64") },
              { type: "ByteString", value: Buffer.from(JSON.stringify([{ binding: "vault" }, { binding: "stream" }])).toString("base64") },
              { type: "ByteString", value: Buffer.from(JSON.stringify({ required: ["escrow_assets"] })).toString("base64") },
              { type: "ByteString", value: Buffer.from(JSON.stringify({ actions: ["createStream"] })).toString("base64") },
              { type: "ByteString", value: Buffer.from("shared").toString("base64") },
              { type: "ByteString", value: "" },
              { type: "ByteString", value: Buffer.from(JSON.stringify({ app_id: "miniapp-neo-pay" })).toString("base64") },
              { type: "Boolean", value: true },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        stack: [
          {
            type: "Struct",
            value: [
              { type: "ByteString", value: Buffer.from("module.funding_vault").toString("base64") },
              { type: "ByteString", value: Buffer.from("1.0.0").toString("base64") },
              { type: "ByteString", value: Buffer.from("958bccb2ec9292461977ef1d2f1222d4e7861537", "hex").reverse().toString("base64") },
              { type: "ByteString", value: "" },
              { type: "ByteString", value: "" },
              { type: "ByteString", value: Buffer.from("custody").toString("base64") },
              { type: "ByteString", value: Buffer.from(JSON.stringify({ accepted_assets: ["NEO", "GAS"] })).toString("base64") },
              { type: "Boolean", value: true },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        stack: [
          {
            type: "Struct",
            value: [
              { type: "ByteString", value: Buffer.from("module.stream_vesting").toString("base64") },
              { type: "ByteString", value: Buffer.from("1.0.0").toString("base64") },
              { type: "ByteString", value: Buffer.from("4fa6544b133457b561e4f9db0248483eca3d33cf", "hex").reverse().toString("base64") },
              { type: "ByteString", value: "" },
              { type: "ByteString", value: "" },
              { type: "ByteString", value: Buffer.from("payments").toString("base64") },
              { type: "ByteString", value: Buffer.from(JSON.stringify({ recipe: "recipe.payment_streams.v1" })).toString("base64") },
              { type: "Boolean", value: true },
            ],
          },
        ],
      });

    jest.doMock("../../lib/chain/rpc-client", () => ({
      invokeRead,
    }));

    const { resolveSharedModeRuntime } = require("../../lib/chain/shared-mode");
    const runtime = await resolveSharedModeRuntime({
      app_id: "miniapp-neo-pay-shared-example",
      name: "NeoPay Modular Fixture",
      description: "",
      icon: "🧩",
      category: "defi",
      entry_url: "mf://manifest?app=miniapp-neo-pay",
      permissions: { payments: true },
      manifest: {
        contract_composition: {
          mode: "shared",
          instance_id: "neopay:testnet:default",
        },
      },
    });

    expect(runtime).toEqual(
      expect.objectContaining({
        instance: expect.objectContaining({
          instanceId: "neopay:testnet:default",
          appId: "miniapp-neo-pay",
          status: 1,
        }),
        recipe: expect.objectContaining({
          recipeId: "recipe.payment_streams.v1",
          active: true,
        }),
        modules: expect.arrayContaining([
          expect.objectContaining({
            binding: "vault",
            moduleId: "module.funding_vault",
            active: true,
          }),
          expect.objectContaining({
            binding: "stream",
            moduleId: "module.stream_vesting",
            active: true,
          }),
        ]),
      }),
    );
  });

  it("falls back to manifest runtime preview when registry reads are unavailable", async () => {
    const invokeRead = jest.fn().mockRejectedValue(new Error("rpc unavailable"));
    jest.doMock("../../lib/chain/rpc-client", () => ({
      invokeRead,
    }));

    const { resolveSharedModeRuntime } = require("../../lib/chain/shared-mode");
    const runtime = await resolveSharedModeRuntime({
      app_id: "miniapp-neo-pay-shared-example",
      name: "NeoPay Shared Runtime",
      description: "",
      icon: "N",
      category: "defi",
      entry_url: "mf://manifest?app=miniapp-neo-pay-shared-example",
      permissions: { payments: true },
      manifest: {
        contract_composition: {
          mode: "shared",
          instance_id: "neopay:testnet:default",
          registries: {
            module_registry: "0x1",
            recipe_registry: "0x2",
            instance_registry: "0x3",
          },
          module_bindings: {
            stream: {
              module_id: "module.stream_vesting",
              version: "1.0.0",
            },
          },
          runtime_preview: {
            instance: {
              app_id: "miniapp-neo-pay",
              recipe_id: "recipe.payment_streams.v1",
              recipe_version: "1.0.0",
              runtime_mode: "shared",
              status: 1,
            },
            modules: [
              {
                binding: "stream",
                module_id: "module.stream_vesting",
                version: "1.0.0",
                contract_hash: "0x4fa6544b133457b561e4f9db0248483eca3d33cf",
                risk_profile: "payments",
                active: true,
              },
            ],
          },
        },
      },
    });

    expect(runtime).toEqual(
      expect.objectContaining({
        instance: expect.objectContaining({
          instanceId: "neopay:testnet:default",
          recipeId: "recipe.payment_streams.v1",
        }),
        modules: [
          expect.objectContaining({
            binding: "stream",
            contractHash: "0x4fa6544b133457b561e4f9db0248483eca3d33cf",
          }),
        ],
      }),
    );
  });

  it("builds shared invoke args from recipe bindings and wallet/input sources", async () => {
    const { buildSharedInvokeArgs } = require("../../lib/chain/shared-mode");

    const args = buildSharedInvokeArgs(
      {
        operation: "createSharedStream",
        binding: "stream",
        method: "createStream",
        args: [
          { source: "instance.instanceId", type: "String" },
          { source: "wallet.address", type: "Hash160" },
          { source: "input.beneficiary", type: "Hash160" },
          { source: "input.asset", type: "Hash160" },
          { source: "input.totalAmount", type: "Integer", scale: 8 },
          { source: "input.rateAmount", type: "Integer", scale: 8 },
          { source: "input.intervalSeconds", type: "Integer" },
          { source: "input.title", type: "String" },
        ],
      },
      {
        beneficiary: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
        asset: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
        totalAmount: "20",
        rateAmount: "1.5",
        intervalSeconds: "2592000",
        title: "Monthly payroll stream",
      },
      {
        network: "testnet",
        registries: {
          moduleRegistry: "0x1",
          recipeRegistry: "0x2",
          instanceRegistry: "0x3",
        },
        instance: {
          instanceId: "neopay:testnet:default",
          appId: "miniapp-neo-pay",
          recipeId: "recipe.payment_streams.v1",
          recipeVersion: "1.0.0",
          runtimeMode: "shared",
          ownerHash: null,
          operatorHash: null,
          developerHash: null,
          routerContractHash: null,
          moduleBindings: null,
          configHash: null,
          frontendRef: null,
          status: 1,
          upgradePending: false,
          updatedAt: null,
        },
        recipe: null,
        modules: [],
      },
      "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
    );

    expect(args).toEqual([
      { type: "String", value: "neopay:testnet:default" },
      { type: "Hash160", value: "0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56" },
      { type: "Hash160", value: "0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56" },
      { type: "Hash160", value: "0xd2a4cff31913016155e38e474a2c06d08be276cf" },
      { type: "Integer", value: "2000000000" },
      { type: "Integer", value: "150000000" },
      { type: "Integer", value: "2592000" },
      { type: "String", value: "Monthly payroll stream" },
    ]);
  });

  it("keeps zero-argument shared operation recipes resolvable", () => {
    const { resolveSharedOperationRecipe } = require("../../lib/chain/shared-mode");

    const recipe = resolveSharedOperationRecipe(
      {
        app_id: "miniapp-neo-pay-shared-example",
        name: "NeoPay Modular Fixture",
        description: "",
        icon: "🧩",
        category: "defi",
        entry_url: "mf://manifest?app=miniapp-neo-pay",
        permissions: { payments: true },
        manifest: {
          contract_composition: {
            mode: "shared",
            instance_id: "neopay:testnet:default",
          },
          frontend_composition: {
            operation_recipes: [
              {
                operation: "syncSharedState",
                binding: "stream",
                method: "syncState",
                args: [],
              },
            ],
          },
        },
      },
      "syncSharedState",
    );

    expect(recipe).toEqual({
      operation: "syncSharedState",
      binding: "stream",
      method: "syncState",
      args: [],
    });
  });
});
