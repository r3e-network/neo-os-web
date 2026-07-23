import { FrameworkCapabilityError } from "./aa";
import { accountToHash160 } from "./chain-surface";
import { WRITE_PRIMARY, guardedWrite } from "./internal/guards";
import type { FrameworkGuardDeps } from "./internal/guards";
import type { Observable } from "./reactive";
import { parseHash160 } from "./utils/neo";
import { parseBigInt, parseBool } from "./utils/parsers";

const HASH160_RE = /^0x[0-9a-fA-F]{40}$/;
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

export interface FrameworkPlatformDeFiConfig {
  defiHash: string;
  neoHash?: string;
  gasHash?: string;
}

export interface FrameworkPlatformDeFiTx {
  txid: string;
  success?: boolean;
  event?: unknown;
  verified?: boolean;
}

export interface FrameworkPlatformDeFiInvokeOptions {
  waitForEvent?: string;
  waitTimeoutMs?: number;
  onTransactionSent?: (txid: string) => void;
}

export interface PlatformDeFiSurfaceChain {
  address: Observable<string | null>;
  ensureWallet(): Promise<string>;
  read(
    operation: string,
    args?: Array<{ type: string; value: unknown }>,
    options?: unknown,
  ): Promise<unknown>;
  invoke(
    operation: string,
    args: Array<{ type: string; value: unknown }>,
    options?: FrameworkPlatformDeFiInvokeOptions & { scriptHash?: string },
  ): Promise<FrameworkPlatformDeFiTx>;
  invokeMultiple(
    calls: Array<{
      scriptHash: string;
      operation: string;
      args: Array<{ type: string; value: unknown }>;
    }>,
    options?: {
      onTransactionSent?: (txid: string) => void;
    },
  ): Promise<{ txid: string; state?: string; exception?: string }>;
}

export interface PlatformDeFiSurfaceDeps {
  appId: string;
  chain: PlatformDeFiSurfaceChain;
  guards: FrameworkGuardDeps;
  config?: FrameworkPlatformDeFiConfig;
}

type Amount = string | number | bigint;

export interface FrameworkPlatformDeFiSurface {
  readonly available: boolean;
  depositNeo(amount: Amount, account?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  depositGas(amount: Amount, account?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  createCapsule(input: { lockDays: Amount; principalAmount: Amount; owner?: string; options?: FrameworkPlatformDeFiInvokeOptions }): Promise<FrameworkPlatformDeFiTx>;
  unlockCapsule(capsuleId: Amount, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  earlyWithdraw(capsuleId: Amount, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  compoundYield(capsuleId: Amount, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  withdrawCapsulePenalties(to?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  getCapsule(capsuleId: Amount): Promise<unknown>;
  getCapsuleStats(): Promise<unknown>;
  getCapsuleDetails(capsuleId: Amount): Promise<unknown>;
  neoCreditOf(account?: string): Promise<bigint>;
  gasCreditOf(account?: string): Promise<bigint>;
  neoCreditLiability(): Promise<bigint>;
  gasCreditLiability(): Promise<bigint>;
  totalNeoCreditLiability(): Promise<bigint>;
  totalGasCreditLiability(): Promise<bigint>;
  withdrawNeoCredit(amount: Amount, account?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  withdrawGasCredit(amount: Amount, account?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  withdrawLendingFees(to?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  getTotalLendingFees(): Promise<bigint>;
  withdrawCapsuleFees(to?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  getTotalCapsuleFees(): Promise<bigint>;
  withdrawFlashLoanFees(to?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  getUnclaimedFlashLoanFees(): Promise<bigint>;
  requestFlashLoan(input: { amount: Amount; callbackContract: string; callbackMethod: string; borrower?: string; options?: FrameworkPlatformDeFiInvokeOptions }): Promise<FrameworkPlatformDeFiTx>;
  flashDeposit(amount: Amount, depositor?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  flashWithdraw(amount: Amount, provider?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  getFlashLoan(loanId: Amount): Promise<unknown>;
  getFlashLoanStats(): Promise<unknown>;
  getFlashProviderBalance(provider?: string): Promise<bigint>;
  getFlashTotalLpDeposits(): Promise<bigint>;
  migrateFlashProviderBalance(provider: string, amount: Amount, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  getLendingLiquidity(): Promise<bigint>;
  lendingDeposit(amount: Amount, funder?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  withdrawLendingLiquidity(amount: Amount, to?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  getCapsuleYieldReserve(): Promise<bigint>;
  fundCapsuleYieldReserve(amount: Amount, funder?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  withdrawCapsuleYieldReserve(amount: Amount, to?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  abandonLoan(loanId: Amount, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  withdrawAbandonedCollateral(to?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  getTotalAbandonedCollateral(): Promise<bigint>;
  setProfitAnchor(contract: string, anchorAppId: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  syncProfitAnchorVote(options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  getProfitAnchorContract(): Promise<string>;
  getProfitAnchorAppId(): Promise<unknown>;
  getProfitAnchor(): Promise<unknown>;
  getLendingProfile(): Promise<bigint>;
  getActiveLoanId(borrower?: string): Promise<bigint>;
  getSingleLoanPosition(borrower?: string): Promise<unknown>;
  getLoan(loanId: Amount): Promise<unknown>;
  getHealthFactor(loanId: Amount): Promise<bigint>;
  getLendingStats(): Promise<unknown>;
  createLoan(input: { ltvTier: Amount; collateralAmount: Amount; borrower?: string; options?: FrameworkPlatformDeFiInvokeOptions }): Promise<FrameworkPlatformDeFiTx>;
  repayLoan(loanId: Amount, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  repayLoanWithGasDeposit(input: {
    loanId: Amount;
    depositAmount: Amount;
    payer?: string;
    options?: FrameworkPlatformDeFiInvokeOptions;
  }): Promise<FrameworkPlatformDeFiTx>;
  addCollateral(loanId: Amount, collateralAmount: Amount, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  getNeoGasPrice(): Promise<bigint>;
  setNeoGasPrice(price: Amount, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  getLastPriceDropTime(): Promise<bigint>;
  liquidateLoan(loanId: Amount, liquidator?: string, options?: FrameworkPlatformDeFiInvokeOptions): Promise<FrameworkPlatformDeFiTx>;
  isLiquidatable(loanId: Amount): Promise<boolean>;
}

function positive(value: Amount, label: string): string {
  const normalized = parseBigInt(value);
  if (normalized <= 0n) throw new Error(`${label} must be a positive integer`);
  return normalized.toString();
}

function nonNegative(value: Amount, label: string): string {
  const normalized = parseBigInt(value);
  if (normalized < 0n) throw new Error(`${label} must be a non-negative integer`);
  return normalized.toString();
}

function requiredString(value: string, label: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

export function createPlatformDeFiSurface(
  deps: PlatformDeFiSurfaceDeps,
): FrameworkPlatformDeFiSurface {
  const config = deps.config;
  const valid = Boolean(config && HASH160_RE.test(String(config.defiHash ?? "").trim()));
  const requireConfig = (): FrameworkPlatformDeFiConfig => {
    if (!config) {
      throw new FrameworkCapabilityError(
        "platformDeFi",
        "Platform DeFi engine is not configured on this host",
      );
    }
    for (const [name, value] of [
      ["defiHash", config.defiHash],
      ["neoHash", config.neoHash ?? NEO_HASH],
      ["gasHash", config.gasHash ?? GAS_HASH],
    ] as const) {
      if (!HASH160_RE.test(String(value ?? "").trim())) {
        throw new FrameworkCapabilityError(
          "platformDeFi",
          `platformDeFi config has an invalid ${name}`,
        );
      }
    }
    return config;
  };
  const hash = (value: string) => value.trim().toLowerCase();
  const defiHash = () => hash(requireConfig().defiHash);
  const neoHash = () => hash(requireConfig().neoHash ?? NEO_HASH);
  const gasHash = () => hash(requireConfig().gasHash ?? GAS_HASH);
  const appId = () => requiredString(deps.appId, "appId");
  const account = async (value?: string): Promise<string> => {
    const resolved = String(value ?? deps.chain.address.get() ?? "").trim() || await deps.chain.ensureWallet();
    return accountToHash160(resolved);
  };
  const tenantArgs = () => [{ type: "String", value: appId() }];
  const accountArg = (value: string) => ({ type: "Hash160", value });
  const amountArg = (value: Amount, label: string) => ({ type: "Integer", value: positive(value, label) });
  const integerArg = (value: Amount, label: string) => ({ type: "Integer", value: nonNegative(value, label) });
  const read = (operation: string, args: Array<{ type: string; value: unknown }> = []) =>
    deps.chain.read(operation, args, { scriptHash: defiHash() });
  const invoke = (
    operation: string,
    args: Array<{ type: string; value: unknown }>,
    options?: FrameworkPlatformDeFiInvokeOptions,
  ) => deps.chain.invoke(operation, args, { ...(options ?? {}), scriptHash: defiHash() });
  const write = <A extends unknown[]>(run: (...args: A) => Promise<FrameworkPlatformDeFiTx>) =>
    guardedWrite(deps.guards, WRITE_PRIMARY, run);
  const deposit = (tokenHash: () => string) => write(async (
    amount: Amount,
    value?: string,
    options?: FrameworkPlatformDeFiInvokeOptions,
  ) => deps.chain.invoke("transfer", [
    accountArg(await account(value)),
    accountArg(defiHash()),
    amountArg(amount, "amount"),
    { type: "String", value: `${appId()}:credit` },
  ], { ...(options ?? {}), scriptHash: tokenHash() }));

  return {
    get available() {
      return valid;
    },
    depositNeo: deposit(neoHash),
    depositGas: deposit(gasHash),
    createCapsule: write(async (input) => invoke("createCapsule", [
      ...tenantArgs(), accountArg(await account(input.owner)),
      amountArg(input.lockDays, "lockDays"), amountArg(input.principalAmount, "principalAmount"),
    ], input.options)),
    unlockCapsule: write(async (capsuleId, options) => invoke("unlockCapsule", [
      ...tenantArgs(), amountArg(capsuleId, "capsuleId"),
    ], options)),
    earlyWithdraw: write(async (capsuleId, options) => invoke("earlyWithdraw", [
      ...tenantArgs(), amountArg(capsuleId, "capsuleId"),
    ], options)),
    compoundYield: write(async (capsuleId, options) => invoke("compoundYield", [
      ...tenantArgs(), amountArg(capsuleId, "capsuleId"),
    ], options)),
    withdrawCapsulePenalties: write(async (to, options) => invoke("withdrawCapsulePenalties", [
      ...tenantArgs(), accountArg(await account(to)),
    ], options)),
    getCapsule: async (capsuleId) => read("getCapsule", [...tenantArgs(), amountArg(capsuleId, "capsuleId")]),
    getCapsuleStats: async () => read("getCapsuleStats", tenantArgs()),
    getCapsuleDetails: async (capsuleId) => read("getCapsuleDetails", [...tenantArgs(), amountArg(capsuleId, "capsuleId")]),
    neoCreditOf: async (value) => parseBigInt(await read("getDirectNeoCredit", [
      ...tenantArgs(), accountArg(await account(value)),
    ])),
    gasCreditOf: async (value) => parseBigInt(await read("getDirectGasCredit", [
      ...tenantArgs(), accountArg(await account(value)),
    ])),
    neoCreditLiability: async () => parseBigInt(await read("neoCreditLiabilityOf", tenantArgs())),
    gasCreditLiability: async () => parseBigInt(await read("gasCreditLiabilityOf", tenantArgs())),
    totalNeoCreditLiability: async () => parseBigInt(await read("totalNeoCreditLiability")),
    totalGasCreditLiability: async () => parseBigInt(await read("totalGasCreditLiability")),
    withdrawNeoCredit: write(async (amount, value, options) => invoke("withdrawNeoCredit", [
      ...tenantArgs(), accountArg(await account(value)), amountArg(amount, "amount"),
    ], options)),
    withdrawGasCredit: write(async (amount, value, options) => invoke("withdrawGasCredit", [
      ...tenantArgs(), accountArg(await account(value)), amountArg(amount, "amount"),
    ], options)),
    withdrawLendingFees: write(async (to, options) => invoke("withdrawLendingFees", [
      ...tenantArgs(), accountArg(await account(to)),
    ], options)),
    getTotalLendingFees: async () => parseBigInt(await read("getTotalLendingFees", tenantArgs())),
    withdrawCapsuleFees: write(async (to, options) => invoke("withdrawCapsuleFees", [
      ...tenantArgs(), accountArg(await account(to)),
    ], options)),
    getTotalCapsuleFees: async () => parseBigInt(await read("getTotalCapsuleFees", tenantArgs())),
    withdrawFlashLoanFees: write(async (to, options) => invoke("withdrawFlashLoanFees", [
      ...tenantArgs(), accountArg(await account(to)),
    ], options)),
    getUnclaimedFlashLoanFees: async () => parseBigInt(await read("getUnclaimedFlashLoanFees", tenantArgs())),
    requestFlashLoan: write(async (input) => invoke("requestFlashLoan", [
      ...tenantArgs(), accountArg(await account(input.borrower)), amountArg(input.amount, "amount"),
      accountArg(accountToHash160(input.callbackContract)),
      { type: "String", value: requiredString(input.callbackMethod, "callbackMethod") },
    ], input.options)),
    flashDeposit: write(async (amount, depositor, options) => invoke("flashDeposit", [
      ...tenantArgs(), accountArg(await account(depositor)), amountArg(amount, "amount"),
    ], options)),
    flashWithdraw: write(async (amount, provider, options) => invoke("flashWithdraw", [
      ...tenantArgs(), accountArg(await account(provider)), amountArg(amount, "amount"),
    ], options)),
    getFlashLoan: async (loanId) => read("getFlashLoan", [...tenantArgs(), amountArg(loanId, "loanId")]),
    getFlashLoanStats: async () => read("getFlashLoanStats", tenantArgs()),
    getFlashProviderBalance: async (provider) => parseBigInt(await read("getFlashProviderBalance", [
      ...tenantArgs(), accountArg(await account(provider)),
    ])),
    getFlashTotalLpDeposits: async () => parseBigInt(await read("getFlashTotalLpDeposits", tenantArgs())),
    migrateFlashProviderBalance: write(async (provider, amount, options) => invoke("migrateFlashProviderBalance", [
      ...tenantArgs(), accountArg(accountToHash160(provider)), amountArg(amount, "amount"),
    ], options)),
    getLendingLiquidity: async () => parseBigInt(await read("getLendingLiquidity", tenantArgs())),
    lendingDeposit: write(async (amount, funder, options) => invoke("lendingDeposit", [
      ...tenantArgs(), accountArg(await account(funder)), amountArg(amount, "amount"),
    ], options)),
    withdrawLendingLiquidity: write(async (amount, to, options) => invoke("withdrawLendingLiquidity", [
      ...tenantArgs(), accountArg(await account(to)), amountArg(amount, "amount"),
    ], options)),
    getCapsuleYieldReserve: async () => parseBigInt(await read("getCapsuleYieldReserve", tenantArgs())),
    fundCapsuleYieldReserve: write(async (amount, funder, options) => invoke("fundCapsuleYieldReserve", [
      ...tenantArgs(), accountArg(await account(funder)), amountArg(amount, "amount"),
    ], options)),
    withdrawCapsuleYieldReserve: write(async (amount, to, options) => invoke("withdrawCapsuleYieldReserve", [
      ...tenantArgs(), accountArg(await account(to)), amountArg(amount, "amount"),
    ], options)),
    abandonLoan: write(async (loanId, options) => invoke("abandonLoan", [
      ...tenantArgs(), amountArg(loanId, "loanId"),
    ], options)),
    withdrawAbandonedCollateral: write(async (to, options) => invoke("withdrawAbandonedCollateral", [
      ...tenantArgs(), accountArg(await account(to)),
    ], options)),
    getTotalAbandonedCollateral: async () => parseBigInt(await read("getTotalAbandonedCollateral", tenantArgs())),
    setProfitAnchor: write(async (contract, anchorAppId, options) => invoke("setProfitAnchor", [
      ...tenantArgs(), accountArg(accountToHash160(contract)),
      { type: "String", value: requiredString(anchorAppId, "anchorAppId") },
    ], options)),
    syncProfitAnchorVote: write(async (options) => invoke("syncProfitAnchorVote", tenantArgs(), options)),
    getProfitAnchorContract: async () => parseHash160(await read("getProfitAnchorContract", tenantArgs())),
    getProfitAnchorAppId: async () => read("getProfitAnchorAppId", tenantArgs()),
    getProfitAnchor: async () => read("getProfitAnchor", tenantArgs()),
    getLendingProfile: async () => parseBigInt(await read("getLendingProfile", tenantArgs())),
    getActiveLoanId: async (borrower) => parseBigInt(await read("getActiveLoanId", [
      ...tenantArgs(), accountArg(await account(borrower)),
    ])),
    getSingleLoanPosition: async (borrower) => read("getSingleLoanPosition", [
      ...tenantArgs(), accountArg(await account(borrower)),
    ]),
    getLoan: async (loanId) => read("getLoan", [...tenantArgs(), amountArg(loanId, "loanId")]),
    getHealthFactor: async (loanId) => parseBigInt(await read("getHealthFactor", [
      ...tenantArgs(), amountArg(loanId, "loanId"),
    ])),
    getLendingStats: async () => read("getLendingStats", tenantArgs()),
    createLoan: write(async (input) => invoke("createLoan", [
      ...tenantArgs(), accountArg(await account(input.borrower)), integerArg(input.ltvTier, "ltvTier"),
      amountArg(input.collateralAmount, "collateralAmount"),
    ], input.options)),
    repayLoan: write(async (loanId, options) => invoke("repayLoan", [
      ...tenantArgs(), amountArg(loanId, "loanId"),
    ], options)),
    repayLoanWithGasDeposit: write(async (input) => {
      const payer = await account(input.payer);
      const depositAmount = parseBigInt(input.depositAmount);
      if (depositAmount < 0n) throw new Error("depositAmount must be a non-negative integer");
      const calls = [];
      if (depositAmount > 0n) {
        calls.push({
          scriptHash: gasHash(),
          operation: "transfer",
          args: [
            accountArg(payer),
            accountArg(defiHash()),
            amountArg(depositAmount, "depositAmount"),
            { type: "String", value: `${appId()}:credit` },
          ],
        });
      }
      calls.push({
        scriptHash: defiHash(),
        operation: "repayLoan",
        args: [...tenantArgs(), amountArg(input.loanId, "loanId")],
      });
      const result = await deps.chain.invokeMultiple(calls, {
        ...(input.options?.onTransactionSent
          ? { onTransactionSent: input.options.onTransactionSent }
          : {}),
      });
      return {
        txid: result.txid,
        success: !String(result.state ?? "").toUpperCase().includes("FAULT"),
      };
    }),
    addCollateral: write(async (loanId, collateralAmount, options) => invoke("addCollateral", [
      ...tenantArgs(), amountArg(loanId, "loanId"), amountArg(collateralAmount, "collateralAmount"),
    ], options)),
    getNeoGasPrice: async () => parseBigInt(await read("getNeoGasPrice", tenantArgs())),
    setNeoGasPrice: write(async (price, options) => invoke("setNeoGasPrice", [
      ...tenantArgs(), amountArg(price, "price"),
    ], options)),
    getLastPriceDropTime: async () => parseBigInt(await read("getLastPriceDropTime", tenantArgs())),
    liquidateLoan: write(async (loanId, liquidator, options) => invoke("liquidateLoan", [
      ...tenantArgs(), amountArg(loanId, "loanId"), accountArg(await account(liquidator)),
    ], options)),
    isLiquidatable: async (loanId) => parseBool(await read("isLiquidatable", [
      ...tenantArgs(), amountArg(loanId, "loanId"),
    ])),
  };
}
