import {
  executeInvokeRecipe,
  WALLET_ADAPTER_UNAVAILABLE_ERROR,
  type ExecuteInvokeRecipeParams,
  type InvokeRecipe,
} from "../../../lib/miniapp-invoke/executor";
import {
  MINIAPP_INVOKE_RECIPES,
  resolveInvokeRecipe,
} from "../../../lib/miniapp-invoke/recipes";
import { getWalletAdapter } from "../../../lib/wallet/store";

jest.mock("../../../lib/wallet/store", () => ({
  getWalletAdapter: jest.fn(),
}));

const WALLET = "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu";
const DIRECT_HASH = "0x740671b10330ef6669ab8b2724437eb8d5e7a34c";
const PLATFORM_HASH = "0xaba84da240a55410d284a656fc8dae044e6ec1a5";

function executeParams(
  overrides: Partial<ExecuteInvokeRecipeParams> = {},
): ExecuteInvokeRecipeParams {
  return {
    appId: "miniapp-example",
    operation: { method: "doThing", name: "Do Thing" } as never,
    values: {},
    walletAddress: WALLET,
    targetNetwork: "testnet",
    resolvedRuntime: null,
    directContractHash: DIRECT_HASH,
    ...overrides,
  };
}

describe("resolveInvokeRecipe", () => {
  it("resolves exact appId:method entries", () => {
    expect(resolveInvokeRecipe("miniapp-dev-tipping", "sendTip")).toBe(
      MINIAPP_INVOKE_RECIPES["miniapp-dev-tipping:sendTip"],
    );
    expect(resolveInvokeRecipe("miniapp-dailycheckin", "checkIn")).toBe(
      MINIAPP_INVOKE_RECIPES["miniapp-dailycheckin:checkIn"],
    );
  });

  it("falls back to wildcard *:method entries for any app", () => {
    expect(resolveInvokeRecipe("miniapp-fogplay", "fundGameCredit")).toBe(
      MINIAPP_INVOKE_RECIPES["*:fundGameCredit"],
    );
    expect(
      resolveInvokeRecipe("miniapp-unbreakablevault", "fundOracleRequestFee"),
    ).toBe(MINIAPP_INVOKE_RECIPES["*:fundOracleRequestFee"]);
  });

  it("returns null when neither an exact nor wildcard entry exists", () => {
    expect(resolveInvokeRecipe("miniapp-dev-tipping", "withdrawTips")).toBeNull();
    expect(resolveInvokeRecipe("miniapp-unknown", "stakeNeo")).toBeNull();
  });
});

describe("executeInvokeRecipe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws the recipe notConfiguredError before building a plan when no hash resolves", async () => {
    const buildPlan = jest.fn();
    const recipe: InvokeRecipe = {
      notConfiguredError: "Example contract is not configured for this network.",
      buildPlan,
    };

    await expect(
      executeInvokeRecipe(
        recipe,
        executeParams({ directContractHash: null }),
      ),
    ).rejects.toThrow("Example contract is not configured for this network.");
    expect(buildPlan).not.toHaveBeenCalled();
    expect(getWalletAdapter).not.toHaveBeenCalled();
  });

  it("prefers the platform runtime contract hash over the direct hash", async () => {
    const invoke = jest.fn().mockResolvedValue({ txid: "0xplatform" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invoke });
    const buildPlan = jest.fn().mockImplementation(({ targetHash }) => ({
      invocation: { scriptHash: targetHash, operation: "ping", args: [] },
      successMessage: (txid: string) => `Done: ${txid}`,
    }));
    const recipe: InvokeRecipe = {
      notConfiguredError: "not configured",
      buildPlan,
    };

    const message = await executeInvokeRecipe(
      recipe,
      executeParams({
        resolvedRuntime: {
          mode: "platform",
          contractHash: PLATFORM_HASH,
        } as never,
      }),
    );

    expect(buildPlan).toHaveBeenCalledWith(
      expect.objectContaining({ targetHash: PLATFORM_HASH }),
    );
    expect(invoke).toHaveBeenCalledWith({
      scriptHash: PLATFORM_HASH,
      operation: "ping",
      args: [],
      signers: [{ account: WALLET, scopes: 1 }],
    });
    expect(message).toBe("Done: 0xplatform");
  });

  it("short-circuits completed plans without touching the wallet adapter", async () => {
    const recipe: InvokeRecipe = {
      notConfiguredError: "not configured",
      buildPlan: () => ({ completedMessage: "Already funded." }),
    };

    await expect(
      executeInvokeRecipe(recipe, executeParams()),
    ).resolves.toBe("Already funded.");
    expect(getWalletAdapter).not.toHaveBeenCalled();
  });

  it("throws the shared adapter-unavailable error when no wallet adapter exists", async () => {
    (getWalletAdapter as jest.Mock).mockReturnValue(null);
    const recipe: InvokeRecipe = {
      notConfiguredError: "not configured",
      buildPlan: ({ targetHash }) => ({
        invocation: { scriptHash: targetHash, operation: "ping", args: [] },
        successMessage: (txid) => txid,
      }),
    };

    await expect(
      executeInvokeRecipe(recipe, executeParams()),
    ).rejects.toThrow(WALLET_ADAPTER_UNAVAILABLE_ERROR);
  });

  it("submits deposit-then-act plans through invokeMultiple with shared signers", async () => {
    const invokeMultiple = jest.fn().mockResolvedValue({ txid: "0xbatch" });
    (getWalletAdapter as jest.Mock).mockReturnValue({ invokeMultiple });
    const deposit = {
      scriptHash: "0xgas",
      operation: "transfer",
      args: [{ type: "String", value: "memo" }],
    };
    const recipe: InvokeRecipe = {
      notConfiguredError: "not configured",
      buildPlan: ({ targetHash }) => ({
        deposits: [deposit],
        invocation: { scriptHash: targetHash, operation: "act", args: [] },
        successMessage: (txid) => `Submitted: ${txid}`,
      }),
    };

    const message = await executeInvokeRecipe(recipe, executeParams());

    expect(invokeMultiple).toHaveBeenCalledWith(
      [deposit, { scriptHash: DIRECT_HASH, operation: "act", args: [] }],
      [{ account: WALLET, scopes: 1 }],
    );
    expect(message).toBe("Submitted: 0xbatch");
  });

  it("surfaces the recipe multi-invoke error when the wallet cannot batch", async () => {
    (getWalletAdapter as jest.Mock).mockReturnValue({ invoke: jest.fn() });
    const recipe: InvokeRecipe = {
      notConfiguredError: "not configured",
      multiInvokeUnavailableError:
        "This wallet cannot submit the required funded example transaction. Open in OneGate or NeoLine.",
      buildPlan: ({ targetHash }) => ({
        deposits: [{ scriptHash: "0xgas", operation: "transfer", args: [] }],
        invocation: { scriptHash: targetHash, operation: "act", args: [] },
        successMessage: (txid) => txid,
      }),
    };

    await expect(
      executeInvokeRecipe(recipe, executeParams()),
    ).rejects.toThrow(
      "This wallet cannot submit the required funded example transaction. Open in OneGate or NeoLine.",
    );
  });
});
