import { createDerived, createObservable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { parseHash160 } from "@shared/utils/neo";
import type { QuadraticFlowKit, Translator } from "./quadraticFlowKit";

export type QuadraticDeploymentStatus =
  | "checking"
  | "ready"
  | "paused"
  | "legacy"
  | "unverified"
  /**
   * No contract has been resolved yet, so there was no snapshot to verify.
   * Deliberately NOT "unavailable": that means "we asked and could not get a
   * trustworthy answer", a real fault. This means "we have not been given
   * anything to ask about", which is what every visitor sees before they
   * connect. Both still block funding writes (fundingWritesEnabled requires
   * "ready"); only the copy differs.
   */
  | "awaiting-context"
  | "unavailable";

const deploymentKey = (network: unknown, contract: unknown, fingerprint: unknown) =>
  [network, contract, fingerprint]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join(":");

/**
 * Production allowlist. Entries bind network, script hash, and a validated
 * on-chain code fingerprint. Add one only after TESTNET_STATUS.md passes.
 */
export const APPROVED_QF_RECOVERY_DEPLOYMENTS: ReadonlySet<string> = new Set();

/**
 * Money-moving QF actions use a two-transaction prepaid-asset flow. A failed
 * second transaction leaves credit on the contract, so a production deployment
 * MUST expose both `directAssetCreditOf` and `reclaimDirectAssetCredit` from the
 * current MiniApp base. The former is only a capability probe, not deployment
 * proof; a code fingerprint and explicit approval are also mandatory. Legacy
 * deployments remain browseable, but the frontend refuses to send a deposit
 * that cannot be recovered.
 */
export function useQuadraticSafety({
  app,
  t,
  kit,
  approvedRecoveryDeployments = APPROVED_QF_RECOVERY_DEPLOYMENTS,
}: {
  app: MiniAppFramework;
  t: Translator;
  kit: QuadraticFlowKit;
  /** Production-validated `network:contract:fingerprint` entries. */
  approvedRecoveryDeployments?: ReadonlySet<string>;
}) {
  const deploymentStatus = createObservable<QuadraticDeploymentStatus>("checking");
  const deploymentMessage = createObservable(t("fundingSafetyChecking"));
  const isCheckingDeployment = createObservable(false);
  const fundingWritesEnabled = createDerived(
    () => deploymentStatus.get() === "ready",
    [deploymentStatus],
  );

  const refreshDeploymentSafety = async (): Promise<QuadraticDeploymentStatus> => {
    if (isCheckingDeployment.get()) return deploymentStatus.get();
    isCheckingDeployment.set(true);
    deploymentStatus.set("checking");
    deploymentMessage.set(t("fundingSafetyChecking"));

    try {
      if (!(await kit.hasChainContext())) {
        deploymentStatus.set("awaiting-context");
        deploymentMessage.set(t("fundingSafetyAwaitingContext"));
        return "awaiting-context";
      }
      const stats = await app.chain.readRaw("getPlatformStats", []);
      if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
        deploymentStatus.set("unavailable");
        deploymentMessage.set(t("fundingSafetyUnavailable"));
        return "unavailable";
      }

      const paused = await app.chain.readRaw("isPaused", []);
      if (paused === true || paused === "true" || paused === 1 || paused === "1") {
        deploymentStatus.set("paused");
        deploymentMessage.set(t("fundingSafetyPaused"));
        return "paused";
      }

      const pauseRegistryRaw = await app.chain.readRaw("pauseRegistry", []);
      const pauseRegistry = parseHash160(pauseRegistryRaw);
      if (pauseRegistry && pauseRegistry !== `0x${"0".repeat(40)}`) {
        const globalPaused = await app.chain.readRaw(
          "isPaused",
          [app.chain.arg.string("miniapp-quadratic-funding")],
          { scriptHash: pauseRegistry },
        );
        if (
          globalPaused === true
          || globalPaused === "true"
          || globalPaused === 1
          || globalPaused === "1"
        ) {
          deploymentStatus.set("paused");
          deploymentMessage.set(t("fundingSafetyPaused"));
          return "paused";
        }
      }

      try {
        const recoveryProbe = await app.chain.readRaw("directAssetCreditOf", [
          app.chain.arg.hash160(BLOCKCHAIN_CONSTANTS.GAS_HASH),
          // Any valid Hash160 is sufficient for a zero-balance safe read. Using
          // the native GAS hash avoids inventing a user identity before connect.
          app.chain.arg.hash160(BLOCKCHAIN_CONSTANTS.GAS_HASH),
        ]);
        if (
          recoveryProbe === null
          || recoveryProbe === undefined
          || !/^-?\d+$/.test(String(recoveryProbe))
        ) {
          throw new Error("invalid recovery probe");
        }
      } catch {
        deploymentStatus.set("legacy");
        deploymentMessage.set(t("fundingSafetyLegacy"));
        return "legacy";
      }

      let fingerprint = "";
      try {
        fingerprint = String(await app.chain.readRaw("deploymentFingerprint", []) ?? "").trim();
      } catch {
        // A recovery method without immutable code identity is not sufficient
        // to survive same-address Neo contract upgrades safely.
      }
      if (!fingerprint) {
        deploymentStatus.set("unverified");
        deploymentMessage.set(t("fundingSafetyUnverified"));
        return "unverified";
      }
      const key = deploymentKey(
        await app.chain.detectNetwork(),
        app.chain.contractAddress.get(),
        fingerprint,
      );
      const approved = [...approvedRecoveryDeployments]
        .some((candidate) => candidate.trim().toLowerCase() === key);
      if (!approved) {
        deploymentStatus.set("unverified");
        deploymentMessage.set(t("fundingSafetyUnverified"));
        return "unverified";
      }

      deploymentStatus.set("ready");
      deploymentMessage.set(t("fundingSafetyReady"));
      return "ready";
    } catch {
      // A throw with no resolvable contract is the pre-connect state, not a
      // failed verification of something real.
      if (!(await kit.hasChainContext().catch(() => false))) {
        deploymentStatus.set("awaiting-context");
        deploymentMessage.set(t("fundingSafetyAwaitingContext"));
        return "awaiting-context";
      }
      deploymentStatus.set("unavailable");
      deploymentMessage.set(t("fundingSafetyUnavailable"));
      return "unavailable";
    } finally {
      isCheckingDeployment.set(false);
    }
  };

  const ensureFundingWritesEnabled = async (): Promise<boolean> => {
    // Never trust a cached "ready" across wallet network changes, manifest
    // contract updates, pause flips, or same-address contract upgrades. Every
    // write re-runs the exact network:contract approval and live probes.
    const status = await refreshDeploymentSafety();
    if (status === "ready") return true;
    kit.setStatus(deploymentMessage.get(), "error");
    return false;
  };

  return {
    deploymentStatus,
    deploymentMessage,
    isCheckingDeployment,
    fundingWritesEnabled,
    refreshDeploymentSafety,
    ensureFundingWritesEnabled,
  };
}
