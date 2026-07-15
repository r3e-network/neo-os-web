import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { MiniAppSetupContext, MiniAppSetupResult } from "@shared/react/defineMiniApp";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import {
  EXTERNAL_INTEGRATIONS,
  getMiniAppContractHash,
  type NeoNetwork,
} from "@shared/constants/rpc";
import { parseHash160, parseStackItem } from "@shared/utils/neo";
import {
  buildAnchorRegistrationInvocations,
  parseAnchorCandidateKeys,
  type AnchorContractArg,
} from "@shared/utils/anchor-agents";
import type { FrameworkContractArg } from "@framework/index";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  CUSTOM_ANCHOR_APP_ID,
  CUSTOM_ANCHOR_BINDINGS,
  CUSTOM_ANCHOR_REGISTRATION_FEE,
  anchorHashesMatch,
  assertAnchorStorage,
  explicitAnchorNetwork,
  formatAnchorFixed,
  formatAnchorWhole,
  isPendingAnchorOperation,
  nextRegistrationStage,
  normalizeAnchorHash,
  parseAnchorInteger,
  parseAnchorNonNegative,
  pendingAnchorEventsMatch,
  persistPendingAnchorOperation,
  readAnchorTransactionOutcome,
  readPendingAnchorOperation,
  type AnchorOperationKind,
  type AnchorRegistrationStage,
  type PendingAnchorOperation,
} from "./anchor-production";

function toChainArgs(args: AnchorContractArg[]): FrameworkContractArg[] {
  return args as unknown as FrameworkContractArg[];
}

const MODE_TRUST = 1;
const REGISTERED_EVENTS_LIMIT = 100;
/**
 * A value the console has not resolved yet. Empty, never a placeholder glyph:
 * the PlayArea owns how an unresolved value looks (a skeleton while a read is
 * in flight, honest zero-state copy when it needs an anchor or a wallet the
 * visitor has not supplied). A "—" here would hard-code a void the view cannot
 * undo. Numeric guards read this as 0/false exactly as they did before.
 */
const UNKNOWN_VALUE = "";

function isStrictAnchorId(value: string): boolean {
  return /^custom-anchor:[a-z0-9-]{1,24}:[a-z0-9-]{1,24}$/.test(value.trim());
}

function isContractAnchorId(value: string): boolean {
  const normalized = value.trim();
  return normalized.length >= 1 && normalized.length <= 64;
}

function firstParam(ctx: MiniAppSetupContext, keys: string[]): string {
  for (const key of keys) {
    const value = String(ctx.launchContext.params?.[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function targetAnchorId(value: unknown): string {
  const anchorAppId = String(value ?? "").trim();
  if (!isContractAnchorId(anchorAppId)) throw new Error("anchorInvalidId");
  return anchorAppId;
}

function strictAnchorId(value: unknown): string {
  const anchorAppId = String(value ?? "").trim();
  if (!isStrictAnchorId(anchorAppId)) throw new Error("invalidAnchorId");
  return anchorAppId;
}

function wholeNeo(value: unknown): bigint {
  const normalized = String(value ?? "").trim();
  if (!/^[1-9]\d*$/.test(normalized)) throw new Error("invalidAmount");
  return BigInt(normalized);
}

function chainHash(value: unknown, allowZero = false): string {
  const parsed = parseHash160(value).toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(parsed) && (allowZero || !/^0x0{40}$/.test(parsed))) return parsed;
  return normalizeAnchorHash(value, allowZero);
}

function publicKey(value: unknown): string {
  const parsed = String(parseStackItem(value) ?? "").trim().replace(/^0x/i, "").toLowerCase();
  return /^0[23][0-9a-f]{64}$/.test(parsed) ? parsed : "";
}

function eventSlots(event: unknown): unknown[] {
  if (!event || typeof event !== "object") return [];
  const state = (event as { state?: unknown }).state;
  if (Array.isArray(state)) return state;
  if (state && typeof state === "object" && "value" in state) {
    const value = (state as { value?: unknown }).value;
    return Array.isArray(value) ? value : [];
  }
  return [];
}

function eventText(value: unknown): string {
  if (value && typeof value === "object" && !("type" in value) && "value" in value) {
    return eventText((value as { value?: unknown }).value);
  }
  const parsed = parseStackItem(value);
  return typeof parsed === "string" ? parsed.trim() : "";
}

function validTxid(value: unknown): string {
  const txid = String(value ?? "").trim().toLowerCase();
  return /^0x[0-9a-f]{64}$/.test(txid) ? txid : "";
}

function isExplicitWalletRejection(error: unknown): boolean {
  const record = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : {};
  if (record.code === 4001 || record.code === "4001" || record.code === "ACTION_REJECTED") return true;
  return /user (?:denied|rejected)|request rejected|action rejected/i.test(String(record.message ?? error ?? ""));
}

defineMiniApp({
  appId: CUSTOM_ANCHOR_APP_ID,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx): MiniAppSetupResult {
    const storage = ctx.framework.storage.local;
    const restored = readPendingAnchorOperation(storage);
    // neo-manifest.json declares MainNet as the product default. An explicit
    // launch network always wins; a missing URL parameter resolves to that
    // declared default instead of leaving the standalone app unusable.
    const launchNetwork: NeoNetwork = explicitAnchorNetwork(ctx.launchContext.network) || "mainnet";
    const launchBinding = CUSTOM_ANCHOR_BINDINGS[launchNetwork];

    const anchorAppId = createObservable(firstParam(ctx, ["anchorAppId", "anchor", "targetAnchor", "app"]));
    const anchorMode = createObservable(-1);
    const totalStaked = createObservable(UNKNOWN_VALUE);
    const rewardReserve = createObservable(UNKNOWN_VALUE);
    const userStake = createObservable(UNKNOWN_VALUE);
    const pendingRewards = createObservable(UNKNOWN_VALUE);
    const agentCount = createObservable(-1);
    const rewardPerNeo = createObservable(UNKNOWN_VALUE);
    const neoCredit = createObservable(UNKNOWN_VALUE);
    const gasCredit = createObservable(UNKNOWN_VALUE);
    const neoCreditRaw = createObservable("");
    const gasCreditRaw = createObservable("");
    const dataStatus = createObservable<"idle" | "loading" | "ready" | "missing" | "unavailable">("idle");
    const creditStatus = createObservable<"idle" | "loading" | "ready" | "disconnected" | "unavailable">("idle");
    const networkStatus = createObservable<"bound" | "verified" | "mismatch" | "unavailable">(
      "bound",
    );
    const pendingOperation = createObservable<PendingAnchorOperation | null>(restored.pending);
    const pendingState = createObservable<
      "none" | "prepared" | "attempted" | "pending" | "readback" | "mismatch" | "fault" | "corrupted" | "confirmed"
    >(restored.corrupted ? "corrupted" : restored.pending ? (restored.pending.phase === "broadcast" ? "pending" : restored.pending.phase) : "none");
    const storageStatus = createObservable<"ready" | "unavailable">(restored.corrupted ? "unavailable" : "ready");
    const lastTxid = createObservable(restored.pending?.txid ?? "");
    const workflowStatus = createObservable(restored.pending ? ctx.t("pendingRestored") : ctx.t("workflowReady"));
    const lastError = createObservable(restored.corrupted ? ctx.t("actionNeedsAttention") : "");
    const errorDetail = createObservable(restored.corrupted ? ctx.t("pendingCorruptedDetail") : "");
    const isLoading = createObservable(false);
    const submitting = createObservable(false);
    const discoveredAnchors = createObservable<Array<{ appId: string; mode: number }>>([]);

    function setFriendlyFailure(detailKey = "actionRetryDetail") {
      lastError.set(ctx.t("actionNeedsAttention"));
      errorDetail.set(ctx.t(detailKey));
      workflowStatus.set(ctx.t("workflowFailed"));
    }

    function clearFailure() {
      lastError.set("");
      errorDetail.set("");
    }

    function requirePublicContext(): { network: NeoNetwork; contractHash: string } {
      const registryHash = normalizeAnchorHash(getMiniAppContractHash(CUSTOM_ANCHOR_APP_ID, launchNetwork));
      const configuredHash = normalizeAnchorHash(ctx.framework.chain.contractAddress?.get?.(), true);
      if (
        !registryHash || !anchorHashesMatch(registryHash, launchBinding.contractHash) ||
        (configuredHash && !anchorHashesMatch(configuredHash, launchBinding.contractHash))
      ) {
        networkStatus.set("mismatch");
        throw new Error("anchorContractMismatch");
      }
      if (networkStatus.get() !== "verified") networkStatus.set("bound");
      return { network: launchNetwork, contractHash: launchBinding.contractHash };
    }

    async function requireWriteContext(): Promise<{ network: NeoNetwork; contractHash: string; walletHash: string; wallet: string }> {
      const context = requirePublicContext();
      const wallet = await ctx.framework.chain.ensureWallet();
      const detected = explicitAnchorNetwork(await ctx.framework.chain.detectNetwork());
      if (!detected || detected !== context.network) {
        networkStatus.set("mismatch");
        throw new Error("anchorWalletNetworkMismatch");
      }
      const walletHash = normalizeAnchorHash(wallet);
      const connectedHash = normalizeAnchorHash(ctx.framework.chain.address.get());
      if (!walletHash || !connectedHash || walletHash !== connectedHash) {
        networkStatus.set("mismatch");
        throw new Error("anchorWalletMismatch");
      }
      networkStatus.set("verified");
      return { ...context, walletHash, wallet };
    }

    function anchorOptions<T extends Record<string, unknown>>(options?: T) {
      const { contractHash } = requirePublicContext();
      return { ...(options ?? {}), scriptHash: contractHash };
    }

    async function readNonNegative(
      operation: string,
      args: FrameworkContractArg[],
      options?: Record<string, unknown>,
    ): Promise<bigint> {
      const raw = await ctx.framework.chain.readRaw(operation, args, options ?? anchorOptions());
      const parsed = parseAnchorNonNegative(raw);
      if (parsed === null) throw new Error("anchorReadUnavailable");
      return parsed;
    }

    async function readCreditRaw(walletHash: string, asset: "NEO" | "GAS"): Promise<bigint> {
      return readNonNegative("getCredit", [
        ctx.framework.chain.arg.hash160(walletHash),
        ctx.framework.chain.arg.string(asset),
      ], anchorOptions());
    }

    async function loadCredits(): Promise<void> {
      const address = ctx.framework.chain.address.get();
      if (!address) {
        neoCredit.set(UNKNOWN_VALUE);
        gasCredit.set(UNKNOWN_VALUE);
        neoCreditRaw.set("");
        gasCreditRaw.set("");
        creditStatus.set("disconnected");
        return;
      }
      const walletHash = normalizeAnchorHash(address);
      if (!walletHash) {
        neoCredit.set(UNKNOWN_VALUE);
        gasCredit.set(UNKNOWN_VALUE);
        neoCreditRaw.set("");
        gasCreditRaw.set("");
        creditStatus.set("unavailable");
        return;
      }
      creditStatus.set("loading");
      try {
        const [neo, gas] = await Promise.all([
          readCreditRaw(walletHash, "NEO"),
          readCreditRaw(walletHash, "GAS"),
        ]);
        neoCreditRaw.set(neo.toString());
        gasCreditRaw.set(gas.toString());
        neoCredit.set(formatAnchorWhole(neo));
        gasCredit.set(formatAnchorFixed(gas));
        creditStatus.set("ready");
      } catch {
        neoCredit.set(UNKNOWN_VALUE);
        gasCredit.set(UNKNOWN_VALUE);
        neoCreditRaw.set("");
        gasCreditRaw.set("");
        creditStatus.set("unavailable");
      }
    }

    async function loadData(): Promise<void> {
      await loadCredits();
      const target = anchorAppId.get().trim();
      if (!target) {
        anchorMode.set(-1);
        dataStatus.set("idle");
        return;
      }
      dataStatus.set("loading");
      isLoading.set(true);
      clearFailure();
      try {
        const targetArg = ctx.framework.chain.arg.string(targetAnchorId(target));
        const modeRaw = await ctx.framework.chain.readRaw("getAppMode", [targetArg], anchorOptions());
        const modeValue = parseAnchorNonNegative(modeRaw);
        if (modeValue === null || modeValue > 2n) throw new Error("anchorReadUnavailable");
        if (modeValue === 0n) {
          anchorMode.set(0);
          totalStaked.set("0");
          rewardReserve.set("0");
          agentCount.set(0);
          rewardPerNeo.set("0");
          userStake.set("0");
          pendingRewards.set("0");
          dataStatus.set("missing");
          workflowStatus.set(ctx.t("anchorNotRegistered"));
          return;
        }
        const [totalRaw, reserveRaw, agentsRaw, rewardRaw] = await Promise.all([
          ctx.framework.chain.readRaw("getTotalStaked", [targetArg], anchorOptions()),
          ctx.framework.chain.readRaw("getRewardReserve", [targetArg], anchorOptions()),
          ctx.framework.chain.readRaw("getAgentCount", [targetArg], anchorOptions()),
          ctx.framework.chain.readRaw("getRewardPerNeo", [targetArg], anchorOptions()),
        ]);
        const total = parseAnchorNonNegative(totalRaw);
        const reserve = parseAnchorNonNegative(reserveRaw);
        const agents = parseAnchorNonNegative(agentsRaw);
        const reward = parseAnchorNonNegative(rewardRaw);
        if (total === null || reserve === null || agents === null || reward === null || agents > 21n) {
          throw new Error("anchorReadUnavailable");
        }

        let walletStake: bigint | null = null;
        let walletRewards: bigint | null = null;
        const address = ctx.framework.chain.address.get();
        if (address) {
          const walletHash = normalizeAnchorHash(address);
          if (!walletHash) throw new Error("anchorWalletMismatch");
          const walletArg = ctx.framework.chain.arg.hash160(walletHash);
          const [stakeRaw, pendingRaw] = await Promise.all([
            ctx.framework.chain.readRaw("getUserStake", [targetArg, walletArg], anchorOptions()),
            ctx.framework.chain.readRaw("getPendingRewards", [targetArg, walletArg], anchorOptions()),
          ]);
          walletStake = parseAnchorNonNegative(stakeRaw);
          walletRewards = parseAnchorNonNegative(pendingRaw);
          if (walletStake === null || walletRewards === null) throw new Error("anchorReadUnavailable");
        }

        anchorMode.set(Number(modeValue));
        totalStaked.set(formatAnchorWhole(total));
        rewardReserve.set(formatAnchorFixed(reserve));
        agentCount.set(Number(agents));
        rewardPerNeo.set(formatAnchorFixed(reward, 16));
        userStake.set(walletStake === null ? UNKNOWN_VALUE : formatAnchorWhole(walletStake));
        pendingRewards.set(walletRewards === null ? UNKNOWN_VALUE : formatAnchorFixed(walletRewards));
        dataStatus.set("ready");
        workflowStatus.set(ctx.t("statusLoaded"));
      } catch {
        dataStatus.set("unavailable");
        setFriendlyFailure("anchorReadUnavailableDetail");
      } finally {
        isLoading.set(false);
      }
    }

    async function loadDiscovered(): Promise<void> {
      try {
        requirePublicContext();
        const events = await ctx.framework.chain.events("AnchorAppRegistered", { limit: REGISTERED_EVENTS_LIMIT });
        const seen = new Set<string>();
        const discovered: Array<{ appId: string; mode: number }> = [];
        for (const event of events) {
          const slots = eventSlots(event);
          const id = eventText(slots[0]);
          const mode = parseAnchorInteger(slots[1]);
          if (!isContractAnchorId(id) || (mode !== 1n && mode !== 2n) || seen.has(id)) continue;
          seen.add(id);
          discovered.push({ appId: id, mode: Number(mode) });
        }
        discovered.reverse();
        discoveredAnchors.set(discovered.slice(0, 12));
      } catch {
        // Discovery is secondary. Preserve verified rows rather than replacing
        // them with a misleading empty result during an indexer outage.
      }
    }

    function storePending(value: PendingAnchorOperation | null): void {
      try {
        persistPendingAnchorOperation(storage, value);
        pendingOperation.set(value);
        storageStatus.set("ready");
        if (!value) lastTxid.set("");
      } catch {
        storageStatus.set("unavailable");
        throw new Error("anchorRecoveryStorageUnavailable");
      }
    }

    function assertCanStart(): void {
      if (pendingOperation.get()) throw new Error("anchorPendingExists");
      if (pendingState.get() === "corrupted") throw new Error("anchorPendingCorrupted");
      try {
        assertAnchorStorage(storage);
        storageStatus.set("ready");
      } catch {
        storageStatus.set("unavailable");
        throw new Error("anchorRecoveryStorageUnavailable");
      }
    }

    function buildPending(
      kind: AnchorOperationKind,
      stage: PendingAnchorOperation["stage"],
      context: { network: NeoNetwork; contractHash: string; walletHash: string },
      intent: PendingAnchorOperation["intent"],
      aaCoreHash = "",
    ): PendingAnchorOperation {
      const now = Date.now();
      const pending: PendingAnchorOperation = {
        version: 2,
        kind,
        stage,
        phase: "prepared",
        network: context.network,
        contractHash: context.contractHash,
        aaCoreHash,
        walletHash: context.walletHash,
        txid: "",
        intent,
        createdAt: now,
        updatedAt: now,
      };
      if (!isPendingAnchorOperation(pending)) throw new Error("anchorPendingInvalid");
      return pending;
    }

    async function readbackMatches(pending: PendingAnchorOperation): Promise<boolean> {
      if (!isPendingAnchorOperation(pending)) return false;
      const anchorArg = ctx.framework.chain.arg.string(pending.intent.anchorAppId);
      const walletArg = ctx.framework.chain.arg.hash160(pending.walletHash);
      if (pending.stage === "register-fee") {
        return (await readCreditRaw(pending.walletHash, "GAS")) >= BigInt(CUSTOM_ANCHOR_REGISTRATION_FEE);
      }
      if (pending.stage === "register-anchor") {
        const [modeRaw, adminRaw] = await Promise.all([
          ctx.framework.chain.readRaw("getAppMode", [anchorArg], anchorOptions()),
          ctx.framework.chain.readRaw("getAppAdmin", [anchorArg], anchorOptions()),
        ]);
        return parseAnchorInteger(modeRaw) === BigInt(pending.intent.mode ?? 0) && chainHash(adminRaw) === pending.walletHash;
      }
      if (pending.stage === "register-accounts") {
        const owners = await Promise.all((pending.intent.agentAccounts ?? []).map((account) =>
          ctx.framework.chain.readRaw("getBackupOwner", [ctx.framework.chain.arg.hash160(account)], { scriptHash: pending.aaCoreHash }),
        ));
        return owners.length === 21 && owners.every((owner) => chainHash(owner) === pending.walletHash);
      }
      if (pending.stage === "register-agents") {
        const count = await readNonNegative("getAgentCount", [anchorArg], anchorOptions());
        if (count !== 21n) return false;
        const accounts = pending.intent.agentAccounts ?? [];
        const candidates = pending.intent.candidateKeys ?? [];
        const bindings = await Promise.all(accounts.map((_, index) => Promise.all([
          ctx.framework.chain.readRaw("getAgentAccount", [anchorArg, ctx.framework.chain.arg.integer(index + 1)], anchorOptions()),
          ctx.framework.chain.readRaw("getAgentCandidate", [anchorArg, ctx.framework.chain.arg.integer(index + 1)], anchorOptions()),
        ])));
        return bindings.length === 21 && bindings.every(([account, candidate], index) =>
          chainHash(account) === normalizeAnchorHash(accounts[index]) && publicKey(candidate) === candidates[index]?.toLowerCase(),
        );
      }
      if (pending.stage === "stake" || pending.stage === "withdraw") {
        const stake = await readNonNegative("getUserStake", [anchorArg, walletArg], anchorOptions());
        return stake.toString() === pending.intent.expectedValue;
      }
      if (pending.stage === "claim") {
        const rewards = await readNonNegative("getPendingRewards", [anchorArg, walletArg], anchorOptions());
        return rewards < BigInt(pending.intent.beforeValue ?? "0");
      }
      if (pending.stage === "recover-credit") {
        const credit = await readCreditRaw(pending.walletHash, pending.intent.asset ?? "GAS");
        return credit.toString() === pending.intent.expectedValue;
      }
      return false;
    }

    async function advanceRegistration(
      pending: PendingAnchorOperation,
      continueNow: boolean,
    ): Promise<boolean> {
      const next = nextRegistrationStage(pending.stage as AnchorRegistrationStage);
      if (next === "complete") {
        storePending(null);
        pendingState.set("confirmed");
        workflowStatus.set(ctx.t("registerSubmitted"));
        await loadData();
        await loadDiscovered();
        return true;
      }
      const prepared: PendingAnchorOperation = {
        ...pending,
        stage: next,
        phase: "prepared",
        txid: "",
        updatedAt: Date.now(),
      };
      storePending(prepared);
      pendingState.set("prepared");
      workflowStatus.set(ctx.t("registerReadyToContinue"));
      if (continueNow) return executePrepared(prepared, true);
      return true;
    }

    async function confirmBroadcast(pending: PendingAnchorOperation, continueNow: boolean): Promise<boolean> {
      if (pending.phase !== "broadcast" || !pending.txid) return false;
      workflowStatus.set(ctx.t("pendingChecking"));
      const outcome = await readAnchorTransactionOutcome(pending.network, pending.txid);
      if (outcome.state === "unknown") {
        pendingState.set("pending");
        workflowStatus.set(ctx.t("pendingStillWaiting"));
        return false;
      }
      if (outcome.state === "fault") {
        storePending(null);
        pendingState.set("fault");
        setFriendlyFailure("pendingFaultDetail");
        return false;
      }
      if (!pendingAnchorEventsMatch(pending, outcome)) {
        pendingState.set("mismatch");
        setFriendlyFailure("pendingEventMismatchDetail");
        return false;
      }
      let readback = false;
      try {
        readback = await readbackMatches(pending);
      } catch {
        readback = false;
      }
      if (!readback) {
        pendingState.set("readback");
        workflowStatus.set(ctx.t("pendingReadbackWaiting"));
        return false;
      }
      if (pending.kind === "register") return advanceRegistration(pending, continueNow);

      storePending(null);
      pendingState.set("confirmed");
      workflowStatus.set(ctx.t(`${pending.kind.replace("-credit", "")}Confirmed`));
      await loadData();
      return true;
    }

    function captureBroadcast(pending: PendingAnchorOperation, transactionId: string): PendingAnchorOperation {
      const txid = validTxid(transactionId);
      if (!txid) throw new Error("anchorTransactionIdUnavailable");
      const broadcast: PendingAnchorOperation = {
        ...pending,
        phase: "broadcast",
        txid,
        updatedAt: Date.now(),
      };
      storePending(broadcast);
      pendingState.set("pending");
      lastTxid.set(txid);
      workflowStatus.set(ctx.t("pendingBroadcast"));
      return broadcast;
    }

    async function executePrepared(pending: PendingAnchorOperation, continueRegistration = false): Promise<boolean> {
      const current = pendingOperation.get();
      if (!current || current.phase !== "prepared" || JSON.stringify(current) !== JSON.stringify(pending)) return false;
      const context = await requireWriteContext();
      if (
        context.network !== pending.network || !anchorHashesMatch(context.contractHash, pending.contractHash) ||
        context.walletHash !== pending.walletHash
      ) throw new Error("anchorPendingContextMismatch");

      if (pending.stage === "register-fee") {
        const credit = await readCreditRaw(pending.walletHash, "GAS");
        if (credit >= BigInt(CUSTOM_ANCHOR_REGISTRATION_FEE)) {
          return advanceRegistration(pending, continueRegistration);
        }
      }

      const attempted: PendingAnchorOperation = { ...pending, phase: "attempted", updatedAt: Date.now() };
      storePending(attempted);
      pendingState.set("attempted");
      workflowStatus.set(ctx.t("pendingWallet"));
      let broadcast = attempted;
      const onTransactionSent = (txid: string) => { broadcast = captureBroadcast(attempted, txid); };

      try {
        let result: { txid?: string };
        if (pending.stage === "register-fee") {
          result = await ctx.framework.chain.invoke("transfer", [
            ctx.framework.chain.arg.hash160(context.walletHash),
            ctx.framework.chain.arg.hash160(context.contractHash),
            ctx.framework.chain.arg.integer(CUSTOM_ANCHOR_REGISTRATION_FEE),
            ctx.framework.chain.arg.string(""),
          ], { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH, onTransactionSent });
        } else if (pending.kind === "register") {
          const candidates = pending.intent.candidateKeys ?? [];
          const plan = buildAnchorRegistrationInvocations({
            appId: pending.intent.anchorAppId,
            mode: pending.intent.mode,
            ownerAddress: pending.walletHash,
            candidateKeys: candidates,
          });
          if (pending.stage === "register-anchor") {
            result = await ctx.framework.chain.invoke("registerCustomAnchorApp", [
              ctx.framework.chain.arg.string(pending.intent.anchorAppId),
              ctx.framework.chain.arg.integer(pending.intent.mode ?? MODE_TRUST),
              ctx.framework.chain.arg.hash160(pending.walletHash),
            ], anchorOptions({ waitForEvent: "AnchorAppRegistered", onTransactionSent }));
          } else if (pending.stage === "register-accounts") {
            const call = plan.invocations.find((invocation) => invocation.operation === "registerAccounts");
            if (!call) throw new Error("anchorProvisioningPlanUnavailable");
            result = await ctx.framework.chain.invoke(call.operation, toChainArgs(call.args), {
              scriptHash: pending.aaCoreHash,
              waitForEvent: "AccountRegistered",
              onTransactionSent,
            });
          } else {
            const call = plan.invocations.find((invocation) => invocation.operation === "registerAgents");
            if (!call) throw new Error("anchorProvisioningPlanUnavailable");
            result = await ctx.framework.chain.invoke(call.operation, toChainArgs(call.args),
              anchorOptions({ waitForEvent: "AnchorAgentRegistered", onTransactionSent }));
          }
        } else if (pending.stage === "stake") {
          result = await ctx.framework.chain.invoke("transfer", [
            ctx.framework.chain.arg.hash160(pending.walletHash),
            ctx.framework.chain.arg.hash160(pending.contractHash),
            ctx.framework.chain.arg.integer(pending.intent.amountBase ?? "0"),
            ctx.framework.chain.arg.string(`stake:${pending.intent.anchorAppId}`),
          ], { scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH, waitForEvent: "AnchorStakeChanged", onTransactionSent });
        } else if (pending.stage === "withdraw") {
          result = await ctx.framework.chain.invoke("withdraw", [
            ctx.framework.chain.arg.string(pending.intent.anchorAppId),
            ctx.framework.chain.arg.hash160(pending.walletHash),
            ctx.framework.chain.arg.integer(pending.intent.amountBase ?? "0"),
          ], anchorOptions({ waitForEvent: "AnchorStakeChanged", onTransactionSent }));
        } else if (pending.stage === "claim") {
          result = await ctx.framework.chain.invoke("claimRewards", [
            ctx.framework.chain.arg.string(pending.intent.anchorAppId),
            ctx.framework.chain.arg.hash160(pending.walletHash),
          ], anchorOptions({ waitForEvent: "AnchorRewardsClaimed", onTransactionSent }));
        } else {
          result = await ctx.framework.chain.invoke("withdrawCredit", [
            ctx.framework.chain.arg.hash160(pending.walletHash),
            ctx.framework.chain.arg.string(pending.intent.asset ?? "GAS"),
            ctx.framework.chain.arg.integer(pending.intent.amountBase ?? "0"),
          ], anchorOptions({ onTransactionSent }));
        }

        if (broadcast.phase !== "broadcast") broadcast = captureBroadcast(attempted, String(result.txid ?? ""));
        return confirmBroadcast(broadcast, continueRegistration);
      } catch (error) {
        if (broadcast.phase !== "broadcast" && isExplicitWalletRejection(error)) {
          storePending(null);
          pendingState.set("none");
          workflowStatus.set(ctx.t("pendingWalletCancelled"));
        }
        throw error;
      }
    }

    async function runWrite<T>(fn: () => Promise<T>): Promise<T | undefined> {
      if (submitting.get()) return undefined;
      submitting.set(true);
      clearFailure();
      try {
        return await fn();
      } catch {
        setFriendlyFailure();
        return undefined;
      } finally {
        submitting.set(false);
      }
    }

    async function startBalanceOperation(
      kind: "stake" | "withdraw" | "claim",
      form: Record<string, unknown>,
    ): Promise<void> {
      assertCanStart();
      const context = await requireWriteContext();
      const target = targetAnchorId(form.anchorAppId || anchorAppId.get());
      const targetArg = ctx.framework.chain.arg.string(target);
      const walletArg = ctx.framework.chain.arg.hash160(context.walletHash);
      const mode = await readNonNegative("getAppMode", [targetArg], anchorOptions());
      if (mode !== 1n && mode !== 2n) throw new Error("anchorNotRegistered");

      let pending: PendingAnchorOperation;
      if (kind === "claim") {
        const before = await readNonNegative("getPendingRewards", [targetArg, walletArg], anchorOptions());
        if (before <= 0n) throw new Error("anchorNoRewards");
        pending = buildPending("claim", "claim", context, {
          anchorAppId: target,
          beforeValue: before.toString(),
          expectedValue: "0",
        });
      } else {
        const amount = wholeNeo(form.amount);
        const before = await readNonNegative("getUserStake", [targetArg, walletArg], anchorOptions());
        if (kind === "withdraw" && before < amount) throw new Error("anchorInsufficientStake");
        const expected = kind === "stake" ? before + amount : before - amount;
        pending = buildPending(kind, kind, context, {
          anchorAppId: target,
          amountBase: amount.toString(),
          beforeValue: before.toString(),
          expectedValue: expected.toString(),
        });
      }
      anchorAppId.set(target);
      storePending(pending);
      pendingState.set("prepared");
      await executePrepared(pending);
    }

    ctx.framework.actions.register("stake", async (...args: unknown[]) => runWrite(async () => {
      await startBalanceOperation("stake", (args[0] ?? {}) as Record<string, unknown>);
    }));

    ctx.framework.actions.register("withdraw", async (...args: unknown[]) => runWrite(async () => {
      await startBalanceOperation("withdraw", (args[0] ?? {}) as Record<string, unknown>);
    }));

    ctx.framework.actions.register("claimRewards", async (...args: unknown[]) => runWrite(async () => {
      await startBalanceOperation("claim", (args[0] ?? {}) as Record<string, unknown>);
    }));

    ctx.framework.actions.register("register", async (...args: unknown[]) => runWrite(async () => {
      assertCanStart();
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = strictAnchorId(form.anchorAppId);
      const context = await requireWriteContext();
      const mode = parseAnchorInteger(form.mode) === 2n ? 2 : MODE_TRUST;
      const candidateKeys = parseAnchorCandidateKeys(
        Array.isArray(form.candidates)
          ? (form.candidates as unknown[]).map(String).join("\n")
          : String(form.candidates ?? ""),
      );
      const aaCoreHash = normalizeAnchorHash(EXTERNAL_INTEGRATIONS[context.network].contracts.aaCore);
      if (!aaCoreHash) throw new Error("anchorAaCoreUnavailable");
      const plan = buildAnchorRegistrationInvocations({
        appId: target,
        mode,
        ownerAddress: context.walletHash,
        candidateKeys,
      });
      const existing = await readNonNegative("getAppMode", [ctx.framework.chain.arg.string(target)], anchorOptions());
      if (existing !== 0n) throw new Error("anchorAlreadyRegistered");
      const gasCredit = await readCreditRaw(context.walletHash, "GAS");
      const stage: AnchorRegistrationStage = gasCredit >= BigInt(CUSTOM_ANCHOR_REGISTRATION_FEE)
        ? "register-anchor"
        : "register-fee";
      const pending = buildPending("register", stage, context, {
        anchorAppId: target,
        mode,
        candidateKeys,
        agentAccounts: plan.agents.map((agent) => agent.accountId),
      }, aaCoreHash);
      anchorAppId.set(target);
      storePending(pending);
      pendingState.set("prepared");
      workflowStatus.set(ctx.t("registerSubmitting"));
      await executePrepared(pending, true);
    }));

    ctx.framework.actions.register("recoverCredit", async (...args: unknown[]) => runWrite(async () => {
      assertCanStart();
      const asset = String(args[0] ?? "") === "NEO" ? "NEO" : "GAS";
      const context = await requireWriteContext();
      const before = await readCreditRaw(context.walletHash, asset);
      if (before <= 0n) throw new Error("noCreditToRecover");
      const pending = buildPending("recover-credit", "recover-credit", context, {
        anchorAppId: anchorAppId.get().trim() || CUSTOM_ANCHOR_APP_ID,
        asset,
        amountBase: before.toString(),
        beforeValue: before.toString(),
        expectedValue: "0",
      });
      storePending(pending);
      pendingState.set("prepared");
      await executePrepared(pending);
    }));

    ctx.framework.actions.register("recoverPending", async () => runWrite(async () => {
      const pending = pendingOperation.get();
      if (!pending) return;
      const context = await requireWriteContext();
      if (
        context.network !== pending.network || context.walletHash !== pending.walletHash ||
        !anchorHashesMatch(context.contractHash, pending.contractHash)
      ) throw new Error("anchorPendingContextMismatch");
      if (pending.phase === "broadcast") {
        await confirmBroadcast(pending, false);
      } else if (pending.phase === "prepared") {
        pendingState.set("prepared");
        workflowStatus.set(ctx.t("pendingReadyToContinue"));
      } else {
        pendingState.set("attempted");
        workflowStatus.set(ctx.t("pendingMissingTxid"));
      }
    }));

    ctx.framework.actions.register("resumePending", async () => runWrite(async () => {
      const pending = pendingOperation.get();
      if (!pending) return;
      if (pending.phase === "broadcast") {
        await confirmBroadcast(pending, false);
        return;
      }
      if (pending.phase !== "prepared") {
        pendingState.set("attempted");
        workflowStatus.set(ctx.t("pendingMissingTxid"));
        return;
      }
      await executePrepared(pending, pending.kind === "register");
    }));

    ctx.framework.actions.register("clearUnbroadcastPending", async () => runWrite(async () => {
      const pending = pendingOperation.get();
      if (!pending || pending.phase !== "attempted" || pending.txid) return;
      const context = await requireWriteContext();
      if (
        context.network !== pending.network || context.walletHash !== pending.walletHash ||
        !anchorHashesMatch(context.contractHash, pending.contractHash)
      ) throw new Error("anchorPendingContextMismatch");
      // This is intentionally user-driven. Unknown attempts stay pending by
      // default; the user may clear only after confirming the wallet rejected
      // before producing a transaction id.
      storePending(null);
      pendingState.set("none");
      workflowStatus.set(ctx.t("pendingClearedByUser"));
    }));

    ctx.framework.actions.register("refreshAnchor", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as Record<string, unknown>;
      const target = String(form.anchorAppId || anchorAppId.get() || "").trim();
      if (target) anchorAppId.set(targetAnchorId(target));
      workflowStatus.set(ctx.t("refreshingStatus"));
      await loadData();
    });

    ctx.framework.actions.register("discoverAnchors", loadDiscovered);

    ctx.framework.actions.register("selectAnchor", async (...args: unknown[]) => {
      const target = String(args[0] ?? "").trim();
      if (!target) return;
      anchorAppId.set(targetAnchorId(target));
      await loadData();
    });

    return {
      state: {
        anchorAppId,
        anchorMode,
        totalStaked,
        rewardReserve,
        userStake,
        pendingRewards,
        agentCount,
        rewardPerNeo,
        lastTxid,
        workflowStatus,
        lastError,
        errorDetail,
        isLoading,
        submitting,
        neoCredit,
        gasCredit,
        dataStatus,
        creditStatus,
        networkStatus,
        storageStatus,
        pendingOperation,
        pendingState,
        discoveredAnchors,
      },
      loadData: async () => {
        await loadData();
        await loadDiscovered();
      },
    };
  },
});
