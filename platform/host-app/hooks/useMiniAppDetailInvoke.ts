import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { NextRouter } from "next/router";
import type { MiniAppInfo } from "../components";
import type { MiniAppLaunchContext, OperationEntry } from "../components/types";
import {
  buildSharedInvokeArgs,
  isSharedModeApp,
  resolveSharedOperationRecipe,
  type SharedModeRuntimeInfo,
} from "../lib/chain";
import type { CatalogNetwork } from "../lib/miniapp-catalog";
import {
  assertWalletNetworkMatchesTarget,
  type NeoNetwork,
} from "../lib/neo-network";
import type { ResolvedMiniAppRuntime } from "../lib/miniapp-runtime";
import type { InvokeParams } from "../lib/wallet/adapters/base";
import { getWalletAdapter } from "../lib/wallet/store";
import {
  buildFrontendOperationQuery,
  buildInvokeArgs,
  frontendOperationFeedback,
  isFrontendLocalOperation,
  isHostManagedApiOperation,
  isOneGateVaultPayoutOperation,
  prepareFrontendOperationQueryValues,
  resolveAnchorOperationAppId,
  resolveNetworkOperationMethod,
} from "../lib/miniapp-detail-helpers";
import {
  buildCustomAnchorRegistrationPlan,
  parseAnchorCandidateKeys,
} from "../lib/custom-anchor";
import { executeInvokeRecipe } from "../lib/miniapp-invoke/executor";
import { invokeAARelayHostApiOperation } from "../lib/miniapp-invoke/host-api";
import { resolveInvokeRecipe } from "../lib/miniapp-invoke/recipes";
import {
  BLOCKCHAIN_CONSTANTS,
  EXTERNAL_INTEGRATIONS,
} from "@shared/constants";

export type MiniAppInvokeFeedback = {
  type: "success" | "error";
  message: string;
  /**
   * Transaction id for txid-bearing successes so the page can render a
   * structured receipt (short txid, explorer link, confirmation tracking)
   * instead of a raw string.
   */
  txid?: string;
};

type UseMiniAppDetailInvokeParams = {
  app: MiniAppInfo | null;
  appSupportsTargetNetwork: boolean;
  directContractHash: string | null;
  launchContext: MiniAppLaunchContext;
  networkAvailabilityReason: string | null;
  resolvedRuntime: ResolvedMiniAppRuntime | null;
  router: NextRouter;
  setInvokeFeedback: Dispatch<SetStateAction<MiniAppInvokeFeedback | null>>;
  sharedRuntime?: SharedModeRuntimeInfo | null;
  targetCatalogNetwork: CatalogNetwork | null;
  targetNetwork: NeoNetwork;
  walletAddress: string | null;
  walletConnected: boolean;
  walletNetwork: NeoNetwork | null;
};

export function useMiniAppDetailInvoke({
  app,
  appSupportsTargetNetwork,
  directContractHash,
  launchContext,
  networkAvailabilityReason,
  resolvedRuntime,
  router,
  setInvokeFeedback,
  sharedRuntime,
  targetCatalogNetwork,
  targetNetwork,
  walletAddress,
  walletConnected,
  walletNetwork,
}: UseMiniAppDetailInvokeParams) {
  return useCallback(
    async (operation: OperationEntry, values: Record<string, string>) => {
      setInvokeFeedback(null);
      try {
        if (!app) {
          throw new Error("MiniApp is unavailable. Return to the catalog and try again.");
        }

        if (isFrontendLocalOperation(operation.method)) {
          const frontendValues = prepareFrontendOperationQueryValues(
            app.app_id,
            operation,
            values,
          );
          const query = buildFrontendOperationQuery(
            router.query,
            operation.method,
            frontendValues,
            targetCatalogNetwork,
          );
          await router.replace(
            { pathname: router.pathname, query },
            undefined,
            { shallow: true },
          );
          setInvokeFeedback({
            type: "success",
            message: frontendOperationFeedback(operation.method),
          });
          return;
        }

        if (isHostManagedApiOperation(app.app_id, operation.method)) {
          if (!appSupportsTargetNetwork) {
            throw new Error(
              networkAvailabilityReason ||
                "MiniApp is not enabled on the selected network.",
            );
          }
          const message = await invokeAARelayHostApiOperation(
            operation.method,
            values,
            targetNetwork,
          );
          setInvokeFeedback({ type: "success", message });
          return;
        }

        if (!walletConnected || !walletAddress) {
          throw new Error("Connect wallet before sending transactions.");
        }
        assertWalletNetworkMatchesTarget(walletNetwork, targetNetwork);
        if (!appSupportsTargetNetwork) {
          throw new Error(
            networkAvailabilityReason ||
              "MiniApp is not enabled on the selected network.",
          );
        }

        if (isOneGateVaultPayoutOperation(operation)) {
          const claimKey = String(values.claimKey || values.key || "").trim();
          if (!claimKey) throw new Error("Claim key is required.");
          const poolId = String(
            values.poolId || values.pool || values.campaignId || "",
          ).trim();
          const oneGateAppId = String(
            values.oneGateAppId ||
              values.oneGateId ||
              values.onegateAppId ||
              "",
          ).trim();
          const miniappId = String(values.appId || app.app_id).trim();
          const response = await fetch("/api/onegate-vault/claim", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              claimKey,
              address: walletAddress,
              network: targetNetwork,
              poolId: poolId || undefined,
              oneGateAppId: oneGateAppId || undefined,
              appId: miniappId || undefined,
            }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            const message =
              typeof body?.error?.message === "string"
                ? body.error.message
                : "OneGate Vault claim failed.";
            throw new Error(message);
          }
          const txid = String(body.txHash || body.tx_hash || "");
          const amount = String(body.amount || "");
          const luckPercent = String(body.luckPercent || "");
          const paid = String(body.status || "") === "paid";
          setInvokeFeedback({
            type: "success",
            message:
              paid && amount && txid
                ? `Reward paid: ${amount} GAS${luckPercent ? ` · luck beat ${luckPercent}%` : ""} (${txid})`
                : "Reward payout submitted. Waiting for chain confirmation.",
          });
          return;
        }

        const recipe = resolveInvokeRecipe(app.app_id, operation.method);
        if (recipe) {
          const message = await executeInvokeRecipe(recipe, {
            appId: app.app_id,
            operation,
            values,
            walletAddress,
            walletNetwork,
            targetNetwork,
            resolvedRuntime,
            directContractHash,
          });
          setInvokeFeedback({ type: "success", message });
          return;
        }

        if (operation.method === "registerCustomAnchor") {
          if (!resolvedRuntime?.contractHash) {
            throw new Error(
              "PlatformAnchor contract is not configured for this network.",
            );
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          if (typeof adapter.invokeMultiple !== "function") {
            throw new Error(
              "This wallet cannot submit the required NEP-21 batch transaction. Open in OneGate or NeoLine.",
            );
          }
          const aaCoreHash =
            EXTERNAL_INTEGRATIONS[targetNetwork].contracts.aaCore;
          const candidateKeys = parseAnchorCandidateKeys(
            values.candidates || "",
          );
          const plan = buildCustomAnchorRegistrationPlan({
            anchorContractHash: resolvedRuntime.contractHash,
            aaCoreHash,
            ownerAddress: walletAddress,
            slug: values.slug || "",
            nonce: values.nonce || "",
            mode: values.mode || "trust",
            candidateKeys,
          });
          const result = await adapter.invokeMultiple(plan.invocations, [
            { account: walletAddress, scopes: 1 },
          ]);
          setInvokeFeedback({
            type: "success",
            message: `Custom Anchor registered: ${plan.appId} (${result.txid})`,
          });
          return;
        }

        const anchorOperationAppId = resolveAnchorOperationAppId(
          app.app_id,
          values,
          launchContext,
        );

        if (operation.method === "stakeNeo" && anchorOperationAppId) {
          if (!resolvedRuntime?.contractHash) {
            throw new Error(
              "PlatformAnchor contract is not configured for this network.",
            );
          }
          const amount = String(values.amount || "").trim();
          if (!/^[1-9]\d*$/.test(amount)) {
            throw new Error("NEO amount must be a positive whole number.");
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
            operation: "transfer",
            args: [
              { type: "Hash160", value: walletAddress },
              { type: "Hash160", value: resolvedRuntime.contractHash },
              { type: "Integer", value: amount },
              { type: "String", value: `stake:${anchorOperationAppId}` },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Stake transaction submitted: ${result.txid}`,
          });
          return;
        }

        if (operation.method === "withdrawNeo" && anchorOperationAppId) {
          if (!resolvedRuntime?.contractHash) {
            throw new Error(
              "PlatformAnchor contract is not configured for this network.",
            );
          }
          const amount = String(values.amount || "").trim();
          if (!/^[1-9]\d*$/.test(amount)) {
            throw new Error("NEO amount must be a positive whole number.");
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: resolvedRuntime.contractHash,
            operation: "withdraw",
            args: [
              { type: "String", value: anchorOperationAppId },
              { type: "Hash160", value: walletAddress },
              { type: "Integer", value: amount },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Redeem transaction submitted: ${result.txid}`,
          });
          return;
        }

        if (operation.method === "claimRewards" && anchorOperationAppId) {
          if (!resolvedRuntime?.contractHash) {
            throw new Error(
              "PlatformAnchor contract is not configured for this network.",
            );
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }
          const result = await adapter.invoke({
            scriptHash: resolvedRuntime.contractHash,
            operation: "claimRewards",
            args: [
              { type: "String", value: anchorOperationAppId },
              { type: "Hash160", value: walletAddress },
            ],
            signers: [{ account: walletAddress, scopes: 1 }],
          });
          setInvokeFeedback({
            type: "success",
            message: `Claim transaction submitted: ${result.txid}`,
          });
          return;
        }

        let txid: string;
        if (resolvedRuntime?.mode === "platform") {
          if (!resolvedRuntime.writesEnabled || !resolvedRuntime.contractHash) {
            throw new Error(
              resolvedRuntime.disabledReason ||
                "Platform runtime is not available on the selected network.",
            );
          }

          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          const args = buildInvokeArgs(
            operation.params ?? [],
            values,
            walletAddress,
          );
          const chainOperation = resolveNetworkOperationMethod(
            app.app_id,
            operation.method,
            targetNetwork,
          );
          const invokePayload: InvokeParams = {
            scriptHash: resolvedRuntime.contractHash,
            operation: chainOperation,
            args,
          };
          invokePayload.signers = [{ account: walletAddress, scopes: 1 }];
          const result = await adapter.invoke(invokePayload);
          txid = result.txid;
        } else if (sharedRuntime && isSharedModeApp(app)) {
          const sharedOperation = resolveSharedOperationRecipe(
            app,
            operation.method,
          );
          if (!sharedOperation) {
            throw new Error(
              "Shared runtime operation is not configured for this miniapp.",
            );
          }
          const targetModule = sharedRuntime.modules.find(
            (module) => module.binding === sharedOperation.binding,
          );
          if (!targetModule?.contractHash) {
            throw new Error(
              `Shared module binding "${sharedOperation.binding}" is unavailable.`,
            );
          }
          const adapter = getWalletAdapter();
          if (!adapter) {
            throw new Error(
              "Wallet adapter unavailable. Reconnect wallet and try again.",
            );
          }

          if (walletAddress.startsWith("0x")) {
            throw new Error(
              "Shared runtime invoke currently supports Neo N3 wallets only.",
            );
          }

          const args = buildSharedInvokeArgs(
            sharedOperation,
            values,
            sharedRuntime,
            walletAddress,
          );
          const invokePayload: InvokeParams = {
            scriptHash: targetModule.contractHash,
            operation: sharedOperation.method,
            args,
          };
          invokePayload.signers = [{ account: walletAddress, scopes: 1 }];
          const result = await adapter.invoke(invokePayload);
          txid = result.txid;
        } else {
          if (!directContractHash) {
            throw new Error(
              "Contract hash is not configured for this miniapp.",
            );
          }

          const args = buildInvokeArgs(
            operation.params ?? [],
            values,
            walletAddress,
          );

          // Neo N3 execution only; embedded EVM auth is not a transaction path here.
          {
            const adapter = getWalletAdapter();
            if (!adapter) {
              throw new Error(
                "Wallet adapter unavailable. Reconnect wallet and try again.",
              );
            }

            const invokePayload: InvokeParams = {
              scriptHash: directContractHash,
              operation: resolveNetworkOperationMethod(
                app.app_id,
                operation.method,
                targetNetwork,
              ),
              args,
            };

            if (walletAddress) {
              invokePayload.signers = [{ account: walletAddress, scopes: 1 }];
            }

            const result = await adapter.invoke(invokePayload);
            txid = result.txid;
          }
        }

        setInvokeFeedback({
          type: "success",
          message: "Transaction submitted.",
          txid,
        });
      } catch (invokeError) {
        const message =
          invokeError instanceof Error
            ? invokeError.message
            : "Operation failed";
        setInvokeFeedback({
          type: "error",
          message,
        });
        throw invokeError;
      }
    },
    [
      app,
      appSupportsTargetNetwork,
      directContractHash,
      launchContext,
      networkAvailabilityReason,
      resolvedRuntime,
      router,
      setInvokeFeedback,
      sharedRuntime,
      targetCatalogNetwork,
      targetNetwork,
      walletAddress,
      walletConnected,
      walletNetwork,
    ],
  );
}
