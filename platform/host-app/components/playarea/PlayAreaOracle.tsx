import React, { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, LockKeyhole, Radio } from "lucide-react";

import {
  getExternalIntegrationConfig,
  resolveNeoNetwork,
} from "../../../../apps/shared/constants/rpc";
import { encryptJsonWithOraclePublicKey } from "../../../../apps/shared/utils/morpheus-confidential-envelope";
import { readSensitiveFrontendOperationValue } from "../../lib/miniapp-detail-helpers";
import {
  ActionBoard,
  ChainStateStrip,
  OracleStatusPanel,
  PlayShell,
  shortHash,
  useLaunchChoiceState,
  useLaunchParamState,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";
import { ORACLE_APP_LABELS } from "./PlayAreaProfiles";

const VRF_PROOF_MODES = ["single-proof", "batch-proof"] as const;
const DEFAULT_NEODID_SUBJECT = "did:neo:testnet:sample-user";
const DEFAULT_NEODID_CLAIM = "profile.kyc";

function cleanPriceSymbol(value: string) {
  const raw = String(value || "")
    .trim()
    .replace(/^TWELVEDATA:/i, "")
    .toUpperCase();
  return raw || "NEO-USD";
}

function positiveRounds(value: string) {
  const raw = String(value || "").trim();
  return /^[1-9]\d*$/.test(raw) ? raw : "1";
}

function oraclePreviewId(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `0x${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function OracleConsolePlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const config = ORACLE_APP_LABELS[app.app_id] || {
    title: app.name,
    mode: "http" as const,
  };
  const defaultOracleEndpoint =
    config.mode === "price"
      ? "TWELVEDATA:NEO-USD"
      : config.mode === "vrf"
        ? `vrf:${app.app_id}:round-1`
        : config.mode === "neodid"
          ? DEFAULT_NEODID_SUBJECT
          : `${getExternalIntegrationConfig(resolveNeoNetwork(network)).morpheusPublicApiUrl}/health`;
  const [endpoint] = useLaunchParamState(
    launchContext,
    ["endpoint", "url", "feed", "symbol", "seed", "salt"],
    defaultOracleEndpoint,
  );
  const [endpointRef] = useLaunchParamState(
    launchContext,
    ["endpoint_ref", "payload_ref"],
    "",
  );
  const [vrfConsumer] = useLaunchParamState(
    launchContext,
    ["consumer", "contract", "contractHash", "appId", "app_id"],
    contractHash || app.app_id,
  );
  const [vrfSalt] = useLaunchParamState(
    launchContext,
    ["salt", "seed", "requestTag", "endpoint"],
    `vrf:${app.app_id}:round-1`,
  );
  const [vrfRounds] = useLaunchParamState(
    launchContext,
    ["rounds", "count"],
    "1",
  );
  const [vrfMode] = useLaunchChoiceState(
    launchContext,
    ["mode", "proofMode"],
    VRF_PROOF_MODES,
    "single-proof",
  );
  const [neoDidClaim] = useLaunchParamState(
    launchContext,
    ["claim", "claimKey", "field", "credential"],
    DEFAULT_NEODID_CLAIM,
  );
  const [neoDidCallback] = useLaunchParamState(
    launchContext,
    ["callback", "callbackContract", "callback_contract"],
    contractHash || "",
  );
  const [result, setResult] = useState("Ready to build request package.");
  const [sealing, setSealing] = useState(false);
  const handledOracleRef = useRef("");
  const confidentialMode =
    config.mode === "compute" ||
    config.mode === "seal" ||
    config.mode === "neodid";
  const sensitiveEndpoint = readSensitiveFrontendOperationValue(endpointRef, {
    appId: app.app_id,
    method: launchContext?.operation || undefined,
    paramName: "endpoint",
  });
  const oracleEndpoint = sensitiveEndpoint || endpoint;
  const hasSensitiveEndpoint = Boolean(sensitiveEndpoint);
  const priceSymbol = cleanPriceSymbol(oracleEndpoint);
  const rounds = positiveRounds(vrfRounds);
  const endpointDigest = oraclePreviewId(oracleEndpoint);
  const displayInputValue =
    config.mode === "price"
      ? priceSymbol
      : config.mode === "vrf"
        ? shortHash(vrfConsumer)
        : confidentialMode && (config.mode !== "neodid" || hasSensitiveEndpoint)
          ? endpointDigest
          : shortHash(oracleEndpoint);
  const displayInputDetail =
    config.mode === "price"
      ? "Morpheus live price feed"
      : config.mode === "vrf"
        ? vrfConsumer || "Consumer pending"
        : config.mode === "compute"
          ? "Sealed compute input stays hidden; only the local digest is shown"
          : config.mode === "seal"
            ? "Sealed payload stays hidden; only the local digest is shown"
            : config.mode === "neodid" && hasSensitiveEndpoint
              ? "DID subject is held in memory for this sealing preview"
              : oracleEndpoint || "Endpoint pending";

  const build = useCallback(() => {
    const callback = "onOracleResult(requestId, result)";
    const payload =
      config.mode === "vrf"
        ? {
            kind: "oracle.vrf.request",
            app_id: app.app_id,
            mode: config.mode,
            consumer: vrfConsumer,
            salt: vrfSalt,
            rounds,
            proof_mode: vrfMode,
            callback,
            nep21: true,
          }
        : config.mode === "price"
          ? {
              kind: "oracle.price.request",
              app_id: app.app_id,
              mode: config.mode,
              provider: "TWELVEDATA",
              symbol: priceSymbol,
              feed: `TWELVEDATA:${priceSymbol}`,
              callback,
              nep21: true,
            }
          : config.mode === "compute"
            ? {
                kind: "oracle.compute.request",
                app_id: app.app_id,
                mode: config.mode,
                workflow: "private-transfer-or-policy-check",
                privacy: "sealed-preview",
                input_digest: oraclePreviewId(oracleEndpoint),
                input_length: oracleEndpoint.length,
                input_visible: false,
                execution: "preview_only",
                dispatch_ready: false,
                callback,
                nep21: true,
              }
            : config.mode === "seal"
              ? {
                  kind: "oracle.seal.request",
                  app_id: app.app_id,
                  mode: config.mode,
                  payload_digest: oraclePreviewId(oracleEndpoint),
                  payload_length: oracleEndpoint.length,
                  payload_visible: false,
                  privacy: "sealed-preview",
                  execution: "preview_only",
                  callback,
                  nep21: true,
                }
              : config.mode === "neodid"
                ? {
                    kind: "oracle.neodid.verify",
                    app_id: app.app_id,
                    mode: config.mode,
                    provider: "neodid",
                    subject: hasSensitiveEndpoint ? undefined : oracleEndpoint,
                    subject_digest: hasSensitiveEndpoint
                      ? oraclePreviewId(oracleEndpoint)
                      : undefined,
                    claim: neoDidClaim,
                    callback_contract: neoDidCallback || undefined,
                    execution: "preview_only",
                    dispatch_ready: false,
                    callback,
                    nep21: true,
                  }
                : {
                    kind: "oracle.http.request",
                    app_id: app.app_id,
                    mode: config.mode,
                    endpoint: oracleEndpoint,
                    callback,
                    nep21: true,
                  };
    setResult(JSON.stringify(payload, null, 2));
  }, [
    app.app_id,
    config.mode,
    hasSensitiveEndpoint,
    oracleEndpoint,
    priceSymbol,
    neoDidCallback,
    neoDidClaim,
    rounds,
    vrfConsumer,
    vrfMode,
    vrfSalt,
  ]);

  const seal = useCallback(async () => {
    setSealing(true);
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
      const confidentialPayload = {
        kind: `oracle.${config.mode}.confidential.v1`,
        app_id: app.app_id,
        mode: config.mode,
        target_chain: "neo_n3",
        network,
        request:
          config.mode === "compute"
            ? {
                workflow: "private-transfer-or-policy-check",
                input: oracleEndpoint,
              }
            : config.mode === "neodid"
              ? {
                  provider: "neodid",
                  subject: oracleEndpoint,
                  claim: neoDidClaim,
                  callback_contract: neoDidCallback || undefined,
                }
              : { payload: oracleEndpoint },
      };
      const ciphertext = await encryptJsonWithOraclePublicKey(
        String(keyMeta.public_key),
        confidentialPayload,
      );
      const storeResponse = await fetch("/api/morpheus/confidential/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          target_chain: "neo_n3",
          app_id: app.app_id,
          name: `${app.app_id}:${config.mode}`,
          ciphertext,
        }),
      });
      const stored = await storeResponse.json().catch(() => ({}));
      const storedRef = String(
        stored?.secret_ref || stored?.id || stored?.ref || "",
      ).trim();
      const storeAvailable =
        storeResponse.ok && !stored?.inline_fallback && Boolean(storedRef);
      setResult(
        JSON.stringify(
          {
            status: storeAvailable ? "sealed_ref" : "sealed_inline",
            mode: config.mode,
            encryption: keyMeta.algorithm || "X25519-HKDF-SHA256-AES-256-GCM",
            encrypted_payload: storeAvailable ? undefined : ciphertext,
            secret_ref: storeAvailable ? storedRef : undefined,
            store_status: stored?.inline_fallback
              ? "Morpheus store unavailable; encrypted payload kept inline."
              : undefined,
            public_key_contract: keyMeta.contract,
          },
          null,
          2,
        ),
      );
    } catch (sealError) {
      setResult(
        JSON.stringify(
          {
            status: "seal_failed",
            error:
              sealError instanceof Error
                ? sealError.message
                : String(sealError),
          },
          null,
          2,
        ),
      );
    } finally {
      setSealing(false);
    }
  }, [
    app.app_id,
    config.mode,
    neoDidCallback,
    neoDidClaim,
    network,
    oracleEndpoint,
  ]);

  useEffect(() => {
    const operation = launchContext?.operation;
    if (operation !== "buildOraclePackage" && operation !== "sealOracleRequest")
      return;
    const signature = `${operation}:${launchContext?.signature || ""}:${oracleEndpoint}:${endpointRef}:${vrfConsumer}:${vrfSalt}:${rounds}:${vrfMode}:${neoDidClaim}:${neoDidCallback}`;
    if (handledOracleRef.current === signature) return;
    handledOracleRef.current = signature;
    if (operation === "sealOracleRequest" && confidentialMode) {
      void seal();
      return;
    }
    build();
  }, [
    build,
    confidentialMode,
    endpointRef,
    launchContext?.operation,
    launchContext?.signature,
    neoDidCallback,
    neoDidClaim,
    oracleEndpoint,
    rounds,
    seal,
    vrfConsumer,
    vrfMode,
    vrfSalt,
  ]);

  const requestRows =
    config.mode === "vrf"
      ? [
          {
            label: "Consumer",
            detail: vrfConsumer || "Consumer pending",
            value: displayInputValue,
            valueLabel: "consumer",
            active: Boolean(vrfConsumer),
            icon: <Radio className="h-4 w-4" />,
          },
          {
            label: "Request salt",
            detail: vrfSalt || "Salt pending",
            value: rounds,
            valueLabel: "rounds",
            active: Boolean(vrfSalt),
            icon: <LockKeyhole className="h-4 w-4" />,
          },
          {
            label: "Proof",
            detail:
              "VRF package includes consumer, salt, count, and proof mode",
            value: vrfMode,
            valueLabel: "mode",
            icon: <BadgeCheck className="h-4 w-4" />,
          },
        ]
      : [
          {
            label:
              config.mode === "price"
                ? "Feed symbol"
                : config.mode === "compute"
                  ? "Input digest"
                : config.mode === "seal"
                  ? "Payload digest"
                  : config.mode === "neodid"
                    ? "DID subject"
                    : "Endpoint",
            detail: displayInputDetail,
            value: oracleEndpoint ? displayInputValue : "waiting",
            valueLabel: "input",
            active: Boolean(oracleEndpoint),
            icon: <Radio className="h-4 w-4" />,
          },
          {
            label: "Privacy",
            detail: confidentialMode
              ? "Morpheus public key is fetched from the selected network"
              : "Plain oracle request",
            value: confidentialMode ? "sealed" : "optional",
            valueLabel: "mode",
            icon: <LockKeyhole className="h-4 w-4" />,
          },
        ];

  return (
    <PlayShell
      app={app}
      title={config.title}
      subtitle="Build a Morpheus request, inspect the callback shape, and verify the result envelope in the same native console."
      tone="sky"
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
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
        <ActionBoard
          title="Oracle request state"
          subtitle="This playarea verifies the request package, privacy mode, and result envelope."
          tone="sky"
          rows={[
            ...requestRows,
            {
              label: "Verification",
              detail: "Callback and result envelope remain inspectable",
              value: "verifiable",
              valueLabel: "state",
              icon: <BadgeCheck className="h-4 w-4" />,
            },
            {
              label: "Builder",
              detail: sealing
                ? "Sealing request with Morpheus"
                : "Operation ready",
              value: sealing ? "sealing" : "ready",
              valueLabel: "state",
            },
          ]}
        />
        <OracleStatusPanel mode={config.mode} result={result} />
      </div>
    </PlayShell>
  );
}
