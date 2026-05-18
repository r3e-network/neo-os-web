import React, { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, LockKeyhole, Radio } from "lucide-react";

import {
  getExternalIntegrationConfig,
  resolveNeoNetwork,
} from "../../../../apps/shared/constants/rpc";
import { encryptJsonWithOraclePublicKey } from "../../../../apps/shared/utils/morpheus-confidential-envelope";
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
      : `${getExternalIntegrationConfig(resolveNeoNetwork(network)).morpheusPublicApiUrl}/health`;
  const [endpoint] = useLaunchParamState(
    launchContext,
    ["endpoint", "url", "feed", "symbol"],
    defaultOracleEndpoint,
  );
  const [result, setResult] = useState("Ready to build request package.");
  const [sealing, setSealing] = useState(false);
  const handledOracleRef = useRef("");
  const confidentialMode =
    config.mode === "compute" ||
    config.mode === "seal" ||
    config.mode === "neodid";

  const build = useCallback(() => {
    const payload = {
      app_id: app.app_id,
      mode: config.mode,
      endpoint,
      callback: "onOracleResult(requestId, result)",
      nep21: true,
    };
    setResult(JSON.stringify(payload, null, 2));
  }, [app.app_id, config.mode, endpoint]);

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
            ? { workflow: "private-transfer-or-policy-check", input: endpoint }
            : config.mode === "neodid"
              ? { provider: "neodid", subject: endpoint }
              : { payload: endpoint },
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
      setResult(
        JSON.stringify(
          {
            status: storeResponse.ok ? "sealed_ref" : "sealed_inline",
            mode: config.mode,
            encryption: keyMeta.algorithm || "X25519-HKDF-SHA256-AES-256-GCM",
            encrypted_payload: storeResponse.ok ? undefined : ciphertext,
            secret_ref: storeResponse.ok
              ? stored.secret_ref || stored.id || stored.ref || "stored"
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
  }, [app.app_id, config.mode, endpoint, network]);

  useEffect(() => {
    const operation = launchContext?.operation;
    if (operation !== "buildOraclePackage" && operation !== "sealOracleRequest")
      return;
    const signature = `${operation}:${launchContext?.signature || ""}:${endpoint}`;
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
    endpoint,
    launchContext?.operation,
    launchContext?.signature,
    seal,
  ]);

  return (
    <PlayShell
      app={app}
      title={config.title}
      subtitle="Build a Morpheus request, inspect the callback shape, and verify the result envelope in the same native console."
      tone="sky"
      side={<OracleStatusPanel mode={config.mode} result={result} />}
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
      <div className="space-y-3">
        <ActionBoard
          title="Oracle request state"
          subtitle="This playarea verifies the request package, privacy mode, and result envelope."
          tone="sky"
          rows={[
            {
              label: config.mode === "price" ? "Feed symbol" : "Endpoint",
              detail: endpoint || "Endpoint pending",
              value: endpoint ? shortHash(endpoint) : "waiting",
              valueLabel: "input",
              active: Boolean(endpoint),
              icon: <Radio className="h-4 w-4" />,
            },
            {
              label: "Privacy",
              detail: confidentialMode
                ? "Morpheus public key required"
                : "Plain oracle request",
              value: confidentialMode ? "sealed" : "optional",
              valueLabel: "mode",
              icon: <LockKeyhole className="h-4 w-4" />,
            },
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
      </div>
    </PlayShell>
  );
}
