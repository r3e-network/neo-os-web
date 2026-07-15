/**
 * Timestamp Proof — Entry Point (React)
 */

import { defineMiniApp, createDerived } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useTimestampProofContract } from "./composables/useTimestampProof";

defineMiniApp({
  appId: "miniapp-timestamp-proof",
  playArea: PlayArea,
  manifest,
  messages,
  // Pin app.storage.local to the legacy runtime-cache namespace so the
  // pre-framework "miniapp-timestamp-proof:proofs:v2" journal key keeps
  // resolving byte-for-byte.
  storagePrefix: "miniapp-timestamp-proof:",

  setup(ctx) {
    const proofContract = useTimestampProofContract({ app: ctx.framework, t: ctx.t });

    const totalProofs = createDerived(
      () => proofContract.proofs.get().length,
      [proofContract.proofs],
    );
    const anchoredProofs = proofContract.anchoredCount;
    // The data layer reports "no proof saved yet" as an empty string and lets
    // each view decide how that reads. It used to emit ctx.t("notAvailable")
    // ("N/A"), which put a placeholder void on two first-run surfaces at once
    // — the DEVICE PROOF route tile and the LATEST ID footer chip — and, worse,
    // defeated their `|| fallback` guards, because "N/A" is a truthy string.
    // A visitor who has simply not saved anything yet is not looking at an
    // unavailable value; the views below say "Waiting" / "None yet" instead.
    const latestId: Observable<string> = {
      get: () => {
        const all = proofContract.proofs.get();
        return all.length > 0 ? `#${all[0]?.id ?? 0}` : "";
      },
      set: () => {},
      subscribe: (listener) => proofContract.proofs.subscribe(listener),
    };

    const reportLastMessage = (type: "info" | "success" | "error" = "info") => {
      const message = proofContract.lastMessage.get();
      if (message) ctx.setStatus(message, type);
    };

    ctx.framework.actions.register("createProof", async (...args: unknown[]) => {
      const content = String(args[0] ?? "");
      return proofContract.createProof(
        content,
        (msg, type) => ctx.setStatus(msg, type === "success" ? "success" : "error"),
        () => {},
      );
    });

    ctx.framework.actions.register("verifyProof", async (...args: unknown[]) => {
      const query = String(args[0] ?? "");
      const network = String(args[1] ?? "");
      await proofContract.verifyProof(query, network);
      const source = proofContract.verificationSource.get();
      reportLastMessage(
        proofContract.verifyError.get() || source === "fault"
          ? "error"
          : source === "local" || source === "chain"
            ? "success"
            : "info",
      );
    });

    ctx.framework.actions.register("copyProofDigest", async (...args: unknown[]) => {
      const ok = await proofContract.copyProofDigest(Number(args[0] ?? 0));
      reportLastMessage(ok ? "success" : "error");
    });

    ctx.framework.actions.register("copyProofReference", async (...args: unknown[]) => {
      const ok = await proofContract.copyProofReference(Number(args[0] ?? 0));
      reportLastMessage(ok ? "success" : "error");
    });

    ctx.framework.actions.register("copyAnchorTxid", async (...args: unknown[]) => {
      const ok = await proofContract.copyAnchorTxid(Number(args[0] ?? 0));
      reportLastMessage(ok ? "success" : "error");
      return ok;
    });

    ctx.framework.actions.register("deleteProof", async (...args: unknown[]) => {
      const ok = await proofContract.deleteProof(Number(args[0] ?? 0));
      reportLastMessage(ok ? "success" : "error");
      return ok;
    });

    ctx.framework.actions.register("clearProofs", async () => {
      const ok = await proofContract.clearProofs();
      reportLastMessage(ok ? "success" : "error");
      return ok;
    });

    ctx.framework.actions.register("clearVerifyError", async () => {
      proofContract.clearVerifyError();
    });

    ctx.framework.actions.register("anchorProof", async (...args: unknown[]) => {
      return proofContract.anchorProof(Number(args[0] ?? 0), (msg, type) =>
        ctx.setStatus(msg, type === "success" ? "success" : type === "error" ? "error" : "info"),
      );
    });

    ctx.framework.actions.register("recoverPendingAnchors", async () => {
      const ok = await proofContract.recoverPendingAnchors();
      reportLastMessage(ok ? "success" : "info");
      return ok;
    });

    ctx.framework.actions.register("releasePreparingAnchor", async (...args: unknown[]) => {
      const ok = await proofContract.releasePreparingAnchor(Number(args[0] ?? 0));
      reportLastMessage(ok ? "success" : "error");
      return ok;
    });

    ctx.framework.actions.register("reloadProofs", async () => {
      const ok = await proofContract.loadProofs();
      reportLastMessage(ok ? "info" : "error");
      return ok;
    });

    return {
      state: {
        totalProofs,
        anchoredProofs,
        isCreating: proofContract.isCreating,
        isVerifying: proofContract.isVerifying,
        isAnchoring: proofContract.isAnchoring,
        isRecovering: proofContract.isRecovering,
        anchoringId: proofContract.anchoringId,
        storageState: proofContract.storageState,
        proofs: proofContract.proofs,
        verifiedProof: proofContract.verifiedProof,
        verificationSource: proofContract.verificationSource,
        verifyError: proofContract.verifyError,
        lastMessage: proofContract.lastMessage,
        latestId,
        network: proofContract.network,
        pendingAnchors: proofContract.pendingCount,
        preparingAnchors: proofContract.preparingCount,
        // Bound so wallet connect/switch re-reads address-derived state.
        address: proofContract.address,
      },
      loadData: async () => {
        await proofContract.loadProofs();
      },
      cleanup: proofContract.stopAddressPolling,
    };
  },
});
