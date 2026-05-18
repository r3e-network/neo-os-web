import React, { useCallback, useEffect, useRef, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";

import {
  buildConfidentialTransferPackage,
  encryptJsonWithOraclePublicKey,
} from "../../../../apps/shared/utils/morpheus-confidential-envelope";
import {
  ActionBoard,
  ChainStateStrip,
  PlayShell,
  PreviewStat,
  shortHash,
  useLaunchChoiceState,
  useLaunchParamState,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

type PrivateTransferResult = {
  status: "idle" | "sealing" | "stored" | "error";
  message: string;
  noteCommitment?: string;
  nullifier?: string;
  secretRef?: string;
  contract?: string;
};

export function PrivateTransferPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [recipient] = useLaunchParamState(
    launchContext,
    ["recipient", "to", "address"],
    "",
  );
  const [amount] = useLaunchParamState(launchContext, ["amount"], "");
  const [asset] = useLaunchChoiceState(
    launchContext,
    ["asset", "token"],
    ["GAS", "NEO"] as const,
    "GAS",
  );
  const [memo] = useLaunchParamState(launchContext, ["memo", "note"], "");
  const [result, setResult] = useState<PrivateTransferResult>({
    status: "idle",
    message: "Ready to seal transfer instructions locally.",
  });
  const handledSealRef = useRef("");

  const sealTransfer = useCallback(async () => {
    setResult({
      status: "sealing",
      message:
        "Fetching Morpheus public key and building a local X25519 envelope.",
    });
    try {
      const keyResponse = await fetch(
        `/api/morpheus/oracle/public-key?network=${encodeURIComponent(network)}`,
      );
      const keyMeta = await keyResponse.json().catch(() => ({}));
      if (!keyResponse.ok || !keyMeta?.public_key) {
        throw new Error(
          keyMeta?.error || "Morpheus oracle public key is unavailable",
        );
      }
      if (
        keyMeta.algorithm &&
        keyMeta.algorithm !== "X25519-HKDF-SHA256-AES-256-GCM"
      ) {
        throw new Error(
          `Unsupported Morpheus encryption algorithm: ${keyMeta.algorithm}`,
        );
      }

      const transferPackage = await buildConfidentialTransferPackage({
        appId: app.app_id,
        network,
        recipient,
        asset,
        amount,
        memo,
      });
      const ciphertext = await encryptJsonWithOraclePublicKey(
        String(keyMeta.public_key),
        transferPackage.confidentialPayload,
      );
      const storeResponse = await fetch("/api/morpheus/confidential/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          target_chain: "neo_n3",
          app_id: app.app_id,
          name: `private-transfer:${transferPackage.publicEnvelope.note_commitment}`,
          ciphertext,
          public_envelope: transferPackage.publicEnvelope,
        }),
      });
      const stored = await storeResponse.json().catch(() => ({}));
      if (!storeResponse.ok) {
        throw new Error(
          stored?.error ||
            stored?.message ||
            "Morpheus confidential store is unavailable",
        );
      }
      const storedRef = String(
        stored.secret_ref || stored.id || stored.ref || "",
      ).trim();
      if (!storedRef) {
        throw new Error(
          "Morpheus confidential store did not return a secret reference",
        );
      }

      setResult({
        status: "stored",
        message:
          "Encrypted transfer intent stored. Only the TEE can decrypt recipient, amount, memo, and note secret.",
        noteCommitment: transferPackage.publicEnvelope.note_commitment,
        nullifier: transferPackage.publicEnvelope.nullifier_hash,
        secretRef: storedRef,
        contract: String(keyMeta.contract || ""),
      });
    } catch (sealError) {
      setResult({
        status: "error",
        message:
          sealError instanceof Error ? sealError.message : String(sealError),
      });
    }
  }, [amount, app.app_id, asset, memo, network, recipient]);

  useEffect(() => {
    if (launchContext?.operation !== "sealPrivateTransfer") return;
    const signature = `${launchContext.signature}:${recipient}:${amount}:${asset}:${memo}`;
    if (!recipient || !amount || handledSealRef.current === signature) return;
    handledSealRef.current = signature;
    void sealTransfer();
  }, [
    amount,
    asset,
    launchContext?.operation,
    launchContext?.signature,
    memo,
    recipient,
    sealTransfer,
  ]);

  return (
    <PlayShell
      app={app}
      title="Confidential transfer desk"
      subtitle="A zERC20-style private transfer workflow without on-chain zk curve assumptions: seal transfer details locally, let Morpheus confidential compute validate them inside the TEE, then return a signed settlement intent."
      tone="slate"
      side={<PrivateTransferStatusPanel result={result} />}
      footer={
        <ChainStateStrip
          loading={loading}
          error={error}
          contractHash={contractHash}
          network={network}
          onRefresh={onRefresh}
        />
      }
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
        <ActionBoard
          title="Private transfer intent"
          subtitle="Recipient, asset, amount, and memo are sealed locally for Morpheus confidential compute before submission."
          tone="slate"
          rows={[
            {
              label: "Recipient",
              detail: recipient || "Recipient pending",
              value: recipient ? shortHash(recipient) : "waiting",
              valueLabel: "address",
              active: Boolean(recipient),
              icon: <LockKeyhole className="h-4 w-4" />,
            },
            {
              label: "Amount",
              detail: "Asset and amount remain private inside the envelope",
              value: amount ? `${amount} ${asset}` : `0 ${asset}`,
              valueLabel: "sealed",
            },
            {
              label: "Private memo",
              detail: memo || "Optional private note",
              value: memo ? "included" : "empty",
              valueLabel: "private",
            },
            {
              label: "Result",
              detail: result.message,
              value: result.status,
              valueLabel: "state",
            },
          ]}
        />

        <div className="rounded-lg border border-violet-100 bg-violet-50 p-4 text-slate-900">
          <h3 className="m-0 flex items-center gap-2 text-sm font-black">
            <ShieldCheck className="h-4 w-4 text-violet-700" />
            Privacy flow
          </h3>
          <div className="mt-4 space-y-3">
            {[
              "Deposit asset into a public escrow or wallet-signed intent.",
              "Encrypt recipient, amount, memo, and note secret in the browser.",
              "Morpheus TEE decrypts, checks policy, and signs a settlement envelope.",
              "Wallet submits release or refund with the signed result.",
            ].map((step, index) => (
              <div key={step} className="flex gap-3 text-sm text-slate-700">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-violet-700 shadow-sm shadow-violet-950/5">
                  {index + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PlayShell>
  );
}

function PrivateTransferStatusPanel({
  result,
}: {
  result: PrivateTransferResult;
}) {
  const tone =
    result.status === "stored"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : result.status === "error"
        ? "border-red-200 bg-red-50 text-red-950"
        : "border-gray-200 bg-white text-gray-950";

  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <h3 className="m-0 text-sm font-black">Morpheus confidential compute</h3>
      <p className="mt-2 text-sm leading-6">{result.message}</p>
      <div className="mt-3 space-y-2">
        {result.secretRef && (
          <PreviewStat label="Secret ref" value={result.secretRef} />
        )}
        {result.noteCommitment && (
          <PreviewStat label="Note commitment" value={result.noteCommitment} />
        )}
        {result.nullifier && (
          <PreviewStat label="Nullifier hash" value={result.nullifier} />
        )}
        {result.contract && (
          <PreviewStat
            label="Oracle contract"
            value={shortHash(result.contract)}
          />
        )}
      </div>
    </div>
  );
}
