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

  setup(ctx) {
    const proofContract = useTimestampProofContract(ctx.t);

    const totalProofs = createDerived(
      () => proofContract.proofs.get().length,
      [proofContract.proofs],
    );
    const anchoredProofs = proofContract.anchoredCount;
    const latestId: Observable<string> = {
      get: () => {
        const all = proofContract.proofs.get();
        return all.length > 0 ? `#${all[0]?.id ?? 0}` : ctx.t("notAvailable");
      },
      set: () => {},
      subscribe: (listener) => proofContract.proofs.subscribe(listener),
    };

    const reportLastMessage = (type: "info" | "success" | "error" = "info") => {
      const message = proofContract.lastMessage.get();
      if (message) ctx.setStatus(message, type);
    };

    ctx.registerAction("createProof", async (...args: unknown[]) => {
      const content = String(args[0] ?? "");
      await proofContract.createProof(
        content,
        (msg, type) => ctx.setStatus(msg, type === "success" ? "success" : "error"),
        () => {},
      );
    });

    ctx.registerAction("verifyProof", async (...args: unknown[]) => {
      const query = String(args[0] ?? "");
      await proofContract.verifyProof(query);
      reportLastMessage(proofContract.verifyError.get() ? "error" : "success");
    });

    ctx.registerAction("copyProofDigest", async (...args: unknown[]) => {
      const ok = await proofContract.copyProofDigest(Number(args[0] ?? 0));
      reportLastMessage(ok ? "success" : "error");
    });

    ctx.registerAction("copyProofReference", async (...args: unknown[]) => {
      const ok = await proofContract.copyProofReference(Number(args[0] ?? 0));
      reportLastMessage(ok ? "success" : "error");
    });

    ctx.registerAction("deleteProof", async (...args: unknown[]) => {
      await proofContract.deleteProof(Number(args[0] ?? 0));
      reportLastMessage("success");
    });

    ctx.registerAction("clearProofs", async () => {
      await proofContract.clearProofs();
      reportLastMessage("success");
    });

    ctx.registerAction("clearVerifyError", async () => {
      proofContract.clearVerifyError();
    });

    ctx.registerAction("anchorProof", async (...args: unknown[]) => {
      await proofContract.anchorProof(Number(args[0] ?? 0), (msg, type) =>
        ctx.setStatus(msg, type === "success" ? "success" : type === "error" ? "error" : "info"),
      );
    });

    return {
      state: {
        totalProofs,
        anchoredProofs,
        isCreating: proofContract.isCreating,
        isVerifying: proofContract.isVerifying,
        isAnchoring: proofContract.isAnchoring,
        anchoringId: proofContract.anchoringId,
        proofs: proofContract.proofs,
        verifiedProof: proofContract.verifiedProof,
        verifyError: proofContract.verifyError,
        lastMessage: proofContract.lastMessage,
        latestId,
        // Bound so wallet connect/switch re-reads address-derived state.
        address: proofContract.address,
      },
      loadData: proofContract.loadProofs,
      cleanup: proofContract.stopAddressPolling,
    };
  },
});
