import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, LockKeyhole, ShieldCheck } from "lucide-react";

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

type SealPhase = "key" | "package" | "store";

const MORPHEUS_ENCRYPTION_ALGORITHM = "X25519-HKDF-SHA256-AES-256-GCM";
const PRIVATE_TRANSFER_FORM_MESSAGE =
  "Recipient and amount are local draft slots until you seal the private intent.";

function isValidNeoAddress(value: string) {
  return /^N[0-9A-Za-z]{33}$/.test(value.trim());
}

function isPositiveAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

function normalizePrivateTransferError(error: unknown, sealPhase: SealPhase) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (
    sealPhase === "key" ||
    /public key|contract.*configured|not configured|network|404|not found/i.test(raw)
  ) {
    return "Morpheus sealing is unavailable for this network. Your transfer details remain local.";
  }
  if (/algorithm|X25519|HKDF|AES/i.test(raw)) {
    return "The selected Morpheus key cannot be used by this client. Your transfer details remain local.";
  }
  if (
    sealPhase === "store" ||
    /secret reference|secret_ref|store|inline_fallback/i.test(raw)
  ) {
    return "Morpheus confidential storage is temporarily unavailable. Your transfer details remain local.";
  }
  return "Private transfer sealing is unavailable right now. Your transfer details remain local.";
}

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
  const formReady = isValidNeoAddress(recipient) && isPositiveAmount(amount);

  const sealTransfer = useCallback(async () => {
    if (!formReady) {
      setResult({
        status: "error",
        message: PRIVATE_TRANSFER_FORM_MESSAGE,
      });
      return;
    }

    setResult({
      status: "sealing",
      message:
        "Fetching Morpheus public key and building a local X25519 envelope.",
    });
    let sealPhase: SealPhase = "key";
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
        keyMeta.algorithm !== MORPHEUS_ENCRYPTION_ALGORITHM
      ) {
        sealPhase = "package";
        throw new Error(
          `Unsupported Morpheus encryption algorithm: ${keyMeta.algorithm}`,
        );
      }

      sealPhase = "package";
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
      sealPhase = "store";
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
      if (stored?.inline_fallback) {
        throw new Error(
          stored?.error || "Morpheus confidential store is unavailable",
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
        message: normalizePrivateTransferError(sealError, sealPhase),
      });
      console.warn(`[private-transfer] seal failed during ${sealPhase} phase`);
    }
  }, [amount, app.app_id, asset, formReady, memo, network, recipient]);

  useEffect(() => {
    if (launchContext?.operation !== "sealPrivateTransfer") return;
    const signature = `${launchContext.signature}:${recipient}:${amount}:${asset}:${memo}`;
    if (!formReady || handledSealRef.current === signature) return;
    handledSealRef.current = signature;
    void sealTransfer();
  }, [
    amount,
    asset,
    launchContext?.operation,
    launchContext?.signature,
    memo,
    recipient,
    formReady,
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
              detail: recipient
                ? isValidNeoAddress(recipient)
                  ? recipient
                  : "Recipient must be a Neo N3 address"
                : "Recipient pending",
              value:
                recipient && isValidNeoAddress(recipient)
                  ? shortHash(recipient)
                  : "waiting",
              valueLabel: "address",
              active: Boolean(recipient && isValidNeoAddress(recipient)),
              icon: <LockKeyhole className="h-4 w-4" />,
            },
            {
              label: "Amount",
              detail: isPositiveAmount(amount)
                ? "Asset and amount remain private inside the envelope"
                : "Enter an amount greater than zero",
              value: isPositiveAmount(amount)
                ? `${amount} ${asset}`
                : `0 ${asset}`,
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
              detail: formReady
                ? result.message
                : PRIVATE_TRANSFER_FORM_MESSAGE,
              value: formReady ? result.status : "draft",
              valueLabel: "state",
            },
          ]}
        />

        <div className="space-y-3">
          {!formReady && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <h3 className="m-0 flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                Draft slots
              </h3>
              <p className="mt-2 text-sm leading-6">
                {PRIVATE_TRANSFER_FORM_MESSAGE}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-teal-100 bg-teal-50 p-4 text-slate-900">
            <h3 className="m-0 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-teal-700" />
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
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-teal-700 shadow-sm shadow-teal-950/5">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
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
        : "border-gray-200 bg-white text-gray-900";

  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <h3 className="m-0 text-sm font-semibold">Morpheus confidential compute</h3>
      <p className="mt-2 text-sm leading-6">{result.message}</p>
      {result.status === "error" && (
        <p className="mt-3 rounded-lg border border-red-200 bg-white/70 px-3 py-2 text-xs font-bold leading-5 text-red-900">
          Nothing was sent on-chain. Fix the inputs or try again when the
          Morpheus service is available.
        </p>
      )}
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
