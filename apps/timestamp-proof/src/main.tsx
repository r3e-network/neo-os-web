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
    const yourProofs = proofContract.myProofsCount;
    const latestId: Observable<string> = {
      get: () => {
        const all = proofContract.proofs.get();
        return all.length > 0 ? `#${all[0]?.id ?? 0}` : ctx.t("notAvailable");
      },
      set: () => {},
      subscribe: (listener) => proofContract.proofs.subscribe(listener),
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
      const id = String(args[0] ?? "");
      await proofContract.verifyProofById(id);
    });

    return {
      state: {
        totalProofs,
        yourProofs,
        isCreating: proofContract.isCreating,
        isVerifying: proofContract.isVerifying,
        proofs: proofContract.proofs,
        verifiedProof: proofContract.verifiedProof,
        verifyError: proofContract.verifyError,
        latestId,
      },
      loadData: proofContract.loadProofs,
    };
  },
});
