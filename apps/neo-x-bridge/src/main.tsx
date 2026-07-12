import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import { createConsolePreviewKernel } from "@shared/components-react/console-kernel";
import PlayArea from "./PlayArea";
import { appId, appMeta, manifest, messages } from "./appConfig";
import {
  connectEvm,
  detectEvmNetwork,
  ensureNeoXNetwork,
  getEvmAccount,
  getInjectedEthereum,
  type EvmNetwork,
} from "@shared/utils/evm-chain";
import {
  bridgeAppUrl,
  bridgeAmountToBaseUnits,
  bridgeAssetDecimals,
  bridgeNetworks,
  buildBridgeVerificationRequest,
  buildAssetBridgeIntent,
  buildStatusTimeline,
  bridgeRoute,
  formatBridgeBaseUnits,
  isBridgeTransactionHash,
  isNeoN3Address,
  isNeoXAddress,
  normalizeBridgeAmount,
  normalizeBridgeAsset,
  normalizeDirection,
  probeBridgeServiceBoundary,
  readNeoXGasBalance,
  resolveBridgeEnvironment,
  restoreAssetBridgeHandoff,
  restoreBridgeVerificationRequest,
  stringifyPayload,
  verifyBridgeSourceTransaction,
  type AssetBridgeHandoff,
  type BridgeAsset,
  type BridgeEnvironment,
  type BridgeOperation,
  type BridgeServiceBoundary,
  type BridgeVerificationEvidence,
  type BridgeVerificationRequest,
  type BridgeWalletSnapshot,
  type TimelineStep,
} from "./bridgeConsole";

const HANDOFF_STORAGE_KEY = "bridge/handoff-v2";
const LEGACY_HANDOFF_STORAGE_KEY = "bridge/handoff-v1";
const VERIFICATION_STORAGE_KEY = "bridge/source-verification-v2";
const LEGACY_VERIFICATION_STORAGE_KEY = "bridge/source-verification-v1";
const LEGACY_SOURCE_TX_STORAGE_KEY = "bridge/source-tx-v1";

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,
  setup(ctx) {
    const bridgeEnvironment: BridgeEnvironment = resolveBridgeEnvironment(
      ctx.launchContext?.network,
    );
    const kernel = createConsolePreviewKernel({
      t: ctx.t,
      networkLabel: appMeta.networkLabel,
      endpointLabel: appMeta.endpointLabel,
      digestPlaceholderKey: "notAvailable",
    });
    const restoredHandoff = restoreAssetBridgeHandoff(
      ctx.framework.storage.local.get<unknown>(HANDOFF_STORAGE_KEY, null),
      bridgeEnvironment,
    );
    ctx.framework.storage.local.delete(LEGACY_HANDOFF_STORAGE_KEY);
    ctx.framework.storage.local.delete(LEGACY_VERIFICATION_STORAGE_KEY);
    const storedVerification = ctx.framework.storage.local.get<unknown>(
      VERIFICATION_STORAGE_KEY,
      null,
    );
    const restoredVerification = restoreBridgeVerificationRequest(
      storedVerification,
      bridgeEnvironment,
      restoredHandoff,
    );
    if (storedVerification && !restoredVerification) {
      ctx.framework.storage.local.delete(VERIFICATION_STORAGE_KEY);
    }
    // The legacy cache held only a hash, with no environment or source-chain
    // binding. Never recover it into a potentially different route.
    ctx.framework.storage.local.delete(LEGACY_SOURCE_TX_STORAGE_KEY);
    const lastRoute = createObservable(
      restoredHandoff ? bridgeRoute(restoredHandoff.direction) : "Neo N3 -> Neo X",
    );
    const lastKind = createObservable("asset");
    const lastPayload = createObservable(ctx.t("emptyPayload"));
    const operationsLog = createObservable<BridgeOperation[]>([]);
    const timeline = createObservable<TimelineStep[]>(
      buildStatusTimeline({
        bridgeKind: "asset",
        direction: restoredVerification?.direction ?? restoredHandoff?.direction ?? "n3-to-neox",
        operationId: restoredHandoff?.requestId ?? "",
        sourceTx: restoredVerification?.sourceTx ?? "",
        asset: restoredHandoff?.token.symbol ?? "GAS",
      }),
    );
    const activeHandoff = createObservable<AssetBridgeHandoff | null>(restoredHandoff);
    const recoverySourceTx = createObservable(restoredVerification?.sourceTx ?? "");
    const recoveryDirection = createObservable(
      restoredVerification?.direction ?? restoredHandoff?.direction ?? "n3-to-neox",
    );
    const verification = createObservable<BridgeVerificationEvidence | null>(null);
    const verificationState = createObservable<"idle" | "checking">("idle");
    const actionBusy = createObservable(false);
    const n3Wallet = createObservable<BridgeWalletSnapshot | null>(null);
    const neoXWallet = createObservable<BridgeWalletSnapshot | null>(null);
    const walletBusy = createObservable<"" | "neo-n3" | "neo-x">("");
    const walletError = createObservable("");
    const serviceBoundary = createObservable<BridgeServiceBoundary>({
      environment: bridgeEnvironment,
      n3Rpc: "checking",
      neoXRpc: "checking",
      quoteService: "official-app-only",
      destinationStatusService: "unavailable",
      checkedAt: "",
    });
    let verificationEpoch = 0;
    let serviceEpoch = 0;
    let n3WalletEpoch = 0;
    let neoXWalletEpoch = 0;
    let disposed = false;

    const clearVerificationRecovery = (
      nextDirection: "n3-to-neox" | "neox-to-n3" = "n3-to-neox",
    ) => {
      verificationEpoch += 1;
      verification.set(null);
      verificationState.set("idle");
      recoverySourceTx.set("");
      recoveryDirection.set(nextDirection);
      ctx.framework.storage.local.delete(VERIFICATION_STORAGE_KEY);
      actionBusy.set(false);
    };

    if (restoredHandoff) {
      kernel.state.lastDigest.set(restoredHandoff.digest);
      kernel.state.lastStatus.set(
        Date.parse(restoredHandoff.snapshotExpiresAt) <= Date.now()
          ? ctx.t("statusHandoffExpired")
          : ctx.t("statusHandoffRestored"),
      );
    }

    const asForm = (formData: unknown): Record<string, unknown> =>
      formData && typeof formData === "object" && !Array.isArray(formData)
        ? formData as Record<string, unknown>
        : {};
    const hasText = (value: unknown): boolean => String(value ?? "").trim().length > 0;
    const showBridgeError = (err: unknown) => {
      const message = err instanceof Error ? err.message : "";
      ctx.setStatus(
        /network identity/i.test(message) ? ctx.t("errSourceNetworkMismatch") : message || ctx.t("errBridgeGeneric"),
        "error",
      );
    };

    const verificationStatusKey = (
      evidence: BridgeVerificationEvidence,
    ): "statusSourceConfirmedNotDelivered" | "statusSourcePending" | "statusSourceFaulted" | "statusSourceUnknown" =>
      evidence.sourceTransaction === "confirmed"
        ? "statusSourceConfirmedNotDelivered"
        : evidence.sourceTransaction === "pending"
          ? "statusSourcePending"
          : evidence.sourceTransaction === "faulted"
            ? "statusSourceFaulted"
            : "statusSourceUnknown";

    const persistHandoffWithReadback = (handoff: AssetBridgeHandoff): AssetBridgeHandoff => {
      ctx.framework.storage.local.set(HANDOFF_STORAGE_KEY, handoff);
      const restored = restoreAssetBridgeHandoff(
        ctx.framework.storage.local.get<unknown>(HANDOFF_STORAGE_KEY, null),
        bridgeEnvironment,
      );
      if (!restored || restored.digest !== handoff.digest) {
        ctx.framework.storage.local.delete(HANDOFF_STORAGE_KEY);
        throw new Error(ctx.t("errHandoffStorage"));
      }
      return restored;
    };

    const persistVerificationWithReadback = (
      request: BridgeVerificationRequest,
      handoff: AssetBridgeHandoff | null,
    ): BridgeVerificationRequest => {
      ctx.framework.storage.local.set(VERIFICATION_STORAGE_KEY, request);
      const restored = restoreBridgeVerificationRequest(
        ctx.framework.storage.local.get<unknown>(VERIFICATION_STORAGE_KEY, null),
        bridgeEnvironment,
        handoff,
      );
      if (!restored || restored.sourceTx !== request.sourceTx) {
        ctx.framework.storage.local.delete(VERIFICATION_STORAGE_KEY);
        throw new Error(ctx.t("errVerificationStorage"));
      }
      return restored;
    };

    const expectedNeoXNetwork: EvmNetwork = bridgeEnvironment === "mainnet"
      ? "neo-x-mainnet"
      : "neo-x-testnet";

    async function refreshN3Wallet(prompt: boolean): Promise<BridgeWalletSnapshot> {
      const epoch = ++n3WalletEpoch;
      if (prompt) walletBusy.set("neo-n3");
      walletError.set("");
      try {
        const existing = ctx.framework.wallet.address();
        if (!prompt && !existing) throw new Error(ctx.t("connectNeoN3WalletFirst"));
        // ensure() re-attests the active NEP-21 account and target network. It
        // does not prompt again when an account is already connected.
        const address = await ctx.framework.wallet.ensure();
        if (!isNeoN3Address(address)) throw new Error(ctx.t("errNeoN3WalletAccount"));
        const [neoUnits, gasUnits] = await Promise.all([
          ctx.framework.wallet.raw("NEO", address),
          ctx.framework.wallet.raw("GAS", address),
        ]);
        if (neoUnits < 0n || gasUnits < 0n) throw new Error(ctx.t("errWalletBalance"));
        if (ctx.framework.wallet.address() !== address) {
          throw new Error(ctx.t("errWalletChangedDuringRead"));
        }
        const snapshot: BridgeWalletSnapshot = {
          environment: bridgeEnvironment,
          chain: "neo-n3",
          network: bridgeEnvironment === "mainnet" ? "neo-n3-mainnet" : "neo-n3-testnet",
          address,
          checkedAt: new Date().toISOString(),
          balances: {
            NEO: { units: neoUnits.toString(), display: formatBridgeBaseUnits(neoUnits, 0), decimals: 0 },
            GAS: { units: gasUnits.toString(), display: formatBridgeBaseUnits(gasUnits, 8), decimals: 8 },
          },
        };
        if (disposed || epoch !== n3WalletEpoch) throw new Error(ctx.t("errWalletChangedDuringRead"));
        n3Wallet.set(snapshot);
        return snapshot;
      } catch (error) {
        if (!disposed && epoch === n3WalletEpoch) {
          n3Wallet.set(null);
          walletError.set(ctx.framework.errors.messageOf(error, ctx.t("errBridgeGeneric")));
        }
        throw error;
      } finally {
        if (!disposed && epoch === n3WalletEpoch && walletBusy.get() === "neo-n3") {
          walletBusy.set("");
        }
      }
    }

    async function refreshNeoXWallet(prompt: boolean): Promise<BridgeWalletSnapshot> {
      const epoch = ++neoXWalletEpoch;
      if (prompt) walletBusy.set("neo-x");
      walletError.set("");
      try {
        let address = await getEvmAccount();
        if (prompt) {
          await ensureNeoXNetwork(expectedNeoXNetwork);
          address = await connectEvm();
        }
        if (!address) throw new Error(ctx.t("connectNeoXWalletFirst"));
        if (!isNeoXAddress(address)) throw new Error(ctx.t("errNeoXWalletAccount"));
        const networkBefore = await detectEvmNetwork();
        if (networkBefore !== expectedNeoXNetwork) throw new Error(ctx.t("errWalletNetworkMismatch"));
        const gasBalance = await readNeoXGasBalance(address, bridgeEnvironment);
        const [networkAfter, accountAfter] = await Promise.all([
          detectEvmNetwork(),
          getEvmAccount(),
        ]);
        if (
          networkAfter !== networkBefore ||
          accountAfter.toLowerCase() !== address.toLowerCase()
        ) {
          throw new Error(ctx.t("errWalletChangedDuringRead"));
        }
        const snapshot: BridgeWalletSnapshot = {
          environment: bridgeEnvironment,
          chain: "neo-x",
          network: expectedNeoXNetwork,
          address,
          checkedAt: new Date().toISOString(),
          balances: {
            NEO: { units: null, display: null, decimals: 0 },
            GAS: { units: gasBalance.units.toString(), display: gasBalance.display, decimals: 18 },
          },
        };
        if (disposed || epoch !== neoXWalletEpoch) throw new Error(ctx.t("errWalletChangedDuringRead"));
        neoXWallet.set(snapshot);
        return snapshot;
      } catch (error) {
        if (!disposed && epoch === neoXWalletEpoch) {
          neoXWallet.set(null);
          walletError.set(ctx.framework.errors.messageOf(error, ctx.t("errBridgeGeneric")));
        }
        throw error;
      } finally {
        if (!disposed && epoch === neoXWalletEpoch && walletBusy.get() === "neo-x") {
          walletBusy.set("");
        }
      }
    }

    async function refreshBridgeWallet(
      chain: "neo-n3" | "neo-x",
      prompt: boolean,
    ): Promise<BridgeWalletSnapshot> {
      return chain === "neo-n3"
        ? refreshN3Wallet(prompt)
        : refreshNeoXWallet(prompt);
    }

    async function verifySourceWalletForDraft(
      form: Record<string, unknown>,
    ): Promise<{ source: BridgeWalletSnapshot; asset: BridgeAsset; amount: string }> {
      const direction = normalizeDirection(form.direction);
      const asset = normalizeBridgeAsset(form.asset);
      const amount = normalizeBridgeAmount(asset, form.amount);
      const networks = bridgeNetworks(direction, bridgeEnvironment);
      const source = await refreshBridgeWallet(networks.source.key, false);
      const expectedSourceNetwork = networks.source.key === "neo-n3"
        ? bridgeEnvironment === "mainnet" ? "neo-n3-mainnet" : "neo-n3-testnet"
        : expectedNeoXNetwork;
      if (
        source.environment !== bridgeEnvironment ||
        source.chain !== networks.source.key ||
        source.network !== expectedSourceNetwork
      ) {
        throw new Error(ctx.t("errWalletNetworkMismatch"));
      }
      const balance = source.balances[asset];
      if (balance.units !== null) {
        const amountUnits = bridgeAmountToBaseUnits(
          amount,
          bridgeAssetDecimals(asset, networks.source.key),
        );
        const balanceUnits = BigInt(balance.units);
        if (
          amountUnits > balanceUnits ||
          (asset === "GAS" && amountUnits === balanceUnits)
        ) {
          throw new Error(ctx.t("errInsufficientBalance"));
        }
      }
      const gasReserve = source.balances.GAS.units;
      if (asset === "NEO" && gasReserve !== null && BigInt(gasReserve) <= 0n) {
        throw new Error(ctx.t("errGasReserve"));
      }

      const destinationCandidate = networks.destination.key === "neo-n3" ? n3Wallet.get() : neoXWallet.get();
      const destination = destinationCandidate?.environment === bridgeEnvironment
        ? await refreshBridgeWallet(networks.destination.key, false)
        : null;
      const recipient = String(form.recipient ?? "").trim();
      if (destination) {
        const sameRecipient = networks.destination.key === "neo-x"
          ? destination.address.toLowerCase() === recipient.toLowerCase()
          : destination.address === recipient;
        if (!sameRecipient) throw new Error(ctx.t("errDestinationWalletMismatch"));
      }
      return { source, asset, amount };
    }

    const unsubscribeN3Wallet = ctx.framework.wallet.onAccountChanged(() => {
      n3WalletEpoch += 1;
      n3Wallet.set(null);
      walletError.set("");
    });

    type ObservableEvmProvider = ReturnType<typeof getInjectedEthereum> & {
      on?: (event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void) => void;
      removeListener?: (event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void) => void;
    };
    const evmProvider = getInjectedEthereum() as ObservableEvmProvider;
    const invalidateNeoXWallet = () => {
      neoXWalletEpoch += 1;
      neoXWallet.set(null);
      walletError.set("");
    };
    evmProvider?.on?.("accountsChanged", invalidateNeoXWallet);
    evmProvider?.on?.("chainChanged", invalidateNeoXWallet);

    async function restoreConnectedWallets(): Promise<void> {
      const jobs: Array<Promise<unknown>> = [];
      if (ctx.framework.wallet.address()) jobs.push(refreshN3Wallet(false));
      if (await getEvmAccount()) jobs.push(refreshNeoXWallet(false));
      await Promise.allSettled(jobs);
    }

    const recordIntent = (intent: {
      operation: BridgeOperation;
      payloadText: string;
      timeline: TimelineStep[];
      handoff?: AssetBridgeHandoff;
    }) => {
      const canonicalHandoff = intent.handoff
        ? persistHandoffWithReadback(intent.handoff)
        : undefined;
      const previous = activeHandoff.get();
      const bindingChanged = !canonicalHandoff || previous?.digest !== canonicalHandoff.digest;
      const sameLiveHandoff = Boolean(
        canonicalHandoff &&
        previous?.digest === canonicalHandoff.digest &&
        Date.parse(previous.snapshotExpiresAt) > Date.now(),
      );
      if (!sameLiveHandoff) {
        operationsLog.set([intent.operation, ...operationsLog.get()].slice(0, 5));
        kernel.recordRequest({
          status: ctx.t(intent.operation.statusKey),
          digest: intent.operation.digest,
        });
      } else {
        kernel.state.lastStatus.set(ctx.t(intent.operation.statusKey));
        kernel.state.lastDigest.set(intent.operation.digest);
      }
      if (canonicalHandoff) {
        if (bindingChanged) clearVerificationRecovery(canonicalHandoff.direction);
        activeHandoff.set(canonicalHandoff);
      } else {
        clearVerificationRecovery(intent.operation.direction);
        activeHandoff.set(null);
        ctx.framework.storage.local.delete(HANDOFF_STORAGE_KEY);
      }
      const currentEvidence = verification.get();
      timeline.set(!bindingChanged && currentEvidence
        ? buildStatusTimeline({
            bridgeKind: "asset",
            direction: currentEvidence.direction,
            operationId: currentEvidence.requestId,
            sourceTx: currentEvidence.sourceTx,
            sourceTransaction: currentEvidence.sourceTransaction,
            sourceEvent: currentEvidence.sourceEvent,
            destinationEvent: currentEvidence.destinationEvent,
            destinationReadback: currentEvidence.destinationReadback,
            asset: canonicalHandoff?.token.symbol ?? previous?.token.symbol ?? "GAS",
          })
        : intent.timeline);
      lastPayload.set(intent.payloadText);
      lastRoute.set(intent.operation.route);
      lastKind.set(intent.operation.kind);
    };

    async function refreshServices() {
      const epoch = ++serviceEpoch;
      serviceBoundary.set({
        environment: bridgeEnvironment,
        n3Rpc: "checking",
        neoXRpc: "checking",
        quoteService: "official-app-only",
        destinationStatusService: "unavailable",
        checkedAt: "",
      });
      try {
        const next = await probeBridgeServiceBoundary(bridgeEnvironment);
        if (!disposed && epoch === serviceEpoch) serviceBoundary.set(next);
      } catch {
        if (!disposed && epoch === serviceEpoch) {
          serviceBoundary.set({
            environment: bridgeEnvironment,
            n3Rpc: "blocked",
            neoXRpc: "blocked",
            quoteService: "official-app-only",
            destinationStatusService: "unavailable",
            checkedAt: new Date().toISOString(),
          });
        }
      }
    }

    async function runSourceVerification(
      request: BridgeVerificationRequest,
      options: { announce?: boolean; recordMetric?: boolean } = {},
    ) {
      const { announce = true, recordMetric = true } = options;
      const epoch = ++verificationEpoch;
      const previousFingerprint = verification.get()?.fingerprint;
      const boundAsset = activeHandoff.get()?.requestId === request.requestId
        ? activeHandoff.get()?.token.symbol ?? "GAS"
        : "GAS";
      verification.set(null);
      recoverySourceTx.set(request.sourceTx);
      recoveryDirection.set(request.direction);
      actionBusy.set(true);
      verificationState.set("checking");
      kernel.state.lastStatus.set(ctx.t("statusCheckingSource"));
      timeline.set(buildStatusTimeline({
        bridgeKind: "asset",
        direction: request.direction,
        operationId: request.requestId,
        sourceTx: request.sourceTx,
        sourceTransaction: "checking",
        asset: boundAsset,
      }));
      try {
        const evidence = await verifyBridgeSourceTransaction(request);
        if (disposed || epoch !== verificationEpoch) return;
        verification.set(evidence);
        timeline.set(buildStatusTimeline({
          bridgeKind: "asset",
          direction: evidence.direction,
          operationId: evidence.requestId,
          sourceTx: evidence.sourceTx,
          sourceTransaction: evidence.sourceTransaction,
          sourceEvent: evidence.sourceEvent,
          destinationEvent: evidence.destinationEvent,
          destinationReadback: evidence.destinationReadback,
          asset: boundAsset,
        }));
        lastRoute.set(bridgeRoute(evidence.direction));
        lastKind.set("asset");
        const status = ctx.t(verificationStatusKey(evidence));
        lastPayload.set(stringifyPayload({
          kind: "neo.nativeBridge.sourceEvidence",
          requestFingerprint: evidence.fingerprint,
          evidence,
          destinationDelivered: false,
        }));
        if (recordMetric && previousFingerprint !== evidence.fingerprint) {
          kernel.recordRequest({ status, digest: evidence.fingerprint });
        } else {
          kernel.state.lastStatus.set(status);
          kernel.state.lastDigest.set(evidence.fingerprint);
        }
        if (announce) {
          ctx.setStatus(status, evidence.sourceTransaction === "faulted" ? "error" : "warning");
        }
      } catch (err) {
        if (!disposed && epoch === verificationEpoch) {
          timeline.set(buildStatusTimeline({
            bridgeKind: "asset",
            direction: request.direction,
            operationId: request.requestId,
            sourceTx: request.sourceTx,
            sourceTransaction: "unknown",
            asset: boundAsset,
          }));
          const message = err instanceof Error ? err.message : "";
          kernel.state.lastStatus.set(
            /network identity/i.test(message)
              ? ctx.t("errSourceNetworkMismatch")
              : message || ctx.t("errBridgeGeneric"),
          );
          if (announce) showBridgeError(err);
        }
      } finally {
        if (!disposed && epoch === verificationEpoch) {
          verificationState.set("idle");
          actionBusy.set(false);
        }
      }
    }

    ctx.framework.actions.register("connectBridgeWallet", async (formData) => {
      const chain = String(asForm(formData).chain ?? "");
      if (chain !== "neo-n3" && chain !== "neo-x") {
        ctx.setStatus(ctx.t("errWalletChain"), "error");
        return;
      }
      if (walletBusy.get() || actionBusy.get()) return;
      try {
        await refreshBridgeWallet(chain, true);
        ctx.setStatus(ctx.t(chain === "neo-n3" ? "statusNeoN3WalletReady" : "statusNeoXWalletReady"), "success");
      } catch (error) {
        showBridgeError(error);
      }
    });

    ctx.framework.actions.register("refreshBridgeWallet", async (formData) => {
      const chain = String(asForm(formData).chain ?? "");
      if (chain !== "neo-n3" && chain !== "neo-x") return;
      if (walletBusy.get() || actionBusy.get()) return;
      try {
        await refreshBridgeWallet(chain, false);
        ctx.setStatus(ctx.t("statusWalletRefreshed"), "success");
      } catch (error) {
        showBridgeError(error);
      }
    });

    ctx.framework.actions.register("prepareAssetBridge", async (formData) => {
      const form = asForm(formData);
      if (actionBusy.get() || walletBusy.get()) return;
      if (!hasText(form.amount) || !hasText(form.recipient)) {
        ctx.setStatus(ctx.t("hintAssetGate"), "error");
        return;
      }
      actionBusy.set(true);
      try {
        const { source, asset, amount } = await verifySourceWalletForDraft(form);
        recordIntent(buildAssetBridgeIntent({
          ...form,
          sourceAccount: source.address,
          asset,
          amount,
        }, undefined, bridgeEnvironment));
        ctx.setStatus(ctx.t("statusAssetReady"), "success");
      } catch (err) {
        showBridgeError(err);
      } finally {
        actionBusy.set(false);
      }
    });

    ctx.framework.actions.register("discardBridgeIntent", async () => {
      const discardedHandoff = activeHandoff.get();
      const discardedDirection = discardedHandoff?.direction ?? recoveryDirection.get();
      const discardedAsset = discardedHandoff?.token.symbol ?? "GAS";
      activeHandoff.set(null);
      ctx.framework.storage.local.delete(HANDOFF_STORAGE_KEY);
      clearVerificationRecovery(discardedDirection);
      timeline.set(buildStatusTimeline({ bridgeKind: "asset", direction: discardedDirection, asset: discardedAsset }));
      lastPayload.set(ctx.t("emptyPayload"));
      kernel.state.lastStatus.set(ctx.t("statusReady"));
    });

    ctx.framework.actions.register("resetBridgeVerification", async (formData) => {
      const direction = normalizeDirection(asForm(formData).direction);
      clearVerificationRecovery(direction);
      const handoff = activeHandoff.get();
      timeline.set(buildStatusTimeline({
        bridgeKind: "asset",
        direction,
        operationId: handoff?.direction === direction ? handoff.requestId : "",
        asset: handoff?.direction === direction ? handoff.token.symbol : "GAS",
      }));
    });

    ctx.framework.actions.register("trackBridgeOperation", async (formData) => {
      const form = asForm(formData);
      const direction = normalizeDirection(form.direction);
      const sourceTx = String(form.sourceTx ?? form.txHash ?? "").trim();
      if (!isBridgeTransactionHash(sourceTx)) {
        ctx.setStatus(ctx.t("errSourceTx"), "error");
        return;
      }
      const currentHandoff = activeHandoff.get();
      const requestId = String(form.operationId ?? currentHandoff?.requestId ?? "").trim();
      const intentDigest = String(form.intentDigest ?? currentHandoff?.digest ?? "").trim();
      if (currentHandoff && (
        currentHandoff.direction !== direction ||
        requestId !== currentHandoff.requestId ||
        intentDigest !== currentHandoff.digest
      )) {
        ctx.setStatus(ctx.t("errHandoffBindingChanged"), "error");
        return;
      }
      try {
        const request = buildBridgeVerificationRequest({
          environment: bridgeEnvironment,
          direction,
          sourceTx,
          requestId,
          intentDigest,
        });
        const persisted = persistVerificationWithReadback(request, currentHandoff);
        await runSourceVerification(persisted);
      } catch (err) {
        showBridgeError(err);
      }
    });

    ctx.framework.actions.register("refreshBridgeServices", async () => {
      await refreshServices();
    });

    return {
      state: {
        ...kernel.state,
        bridgeEnvironment: createObservable<BridgeEnvironment>(bridgeEnvironment),
        bridgeAppUrl: createObservable(bridgeAppUrl(bridgeEnvironment)),
        lastRoute,
        lastKind,
        lastPayload,
        operationsLog,
        timeline,
        activeHandoff,
        recoverySourceTx,
        recoveryDirection,
        verification,
        verificationState,
        actionBusy,
        n3Wallet,
        neoXWallet,
        walletBusy,
        walletError,
        serviceBoundary,
      },
      loadData: async () => {
        await Promise.all([
          refreshServices(),
          restoreConnectedWallets(),
          restoredVerification
            ? runSourceVerification(restoredVerification, { announce: false, recordMetric: false })
            : Promise.resolve(),
        ]);
      },
      cleanup: () => {
        disposed = true;
        verificationEpoch += 1;
        serviceEpoch += 1;
        n3WalletEpoch += 1;
        neoXWalletEpoch += 1;
        unsubscribeN3Wallet();
        evmProvider?.removeListener?.("accountsChanged", invalidateNeoXWallet);
        evmProvider?.removeListener?.("chainChanged", invalidateNeoXWallet);
      },
    };
  },
});
