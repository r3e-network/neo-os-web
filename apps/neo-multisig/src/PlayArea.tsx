/**
 * PlayArea.tsx — Neo Multisig (v2 scene-driven rebuild)
 * Tool/DeFi identity. The vault IS the scene: a multi-sig vault with approval
 * progress. Approve is primary; vault list + create + propose tucked in drawer.
 * Full state + all 7 dispatch actions preserved.
 */
import { useState, type CSSProperties } from "react";
import { CheckCircle2, CircleDashed, FileSignature, KeyRound, Search, ShieldCheck, UsersRound } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface P { t: (k: string, p?: Record<string, string|number>) => string; state: ObservableState; dispatch: (n: string, ...a: unknown[]) => Promise<void>; }

const VAULT_STAGE_IMAGE = "multisig-vault-stage.webp";

function text(t: P["t"], key: string, fallback: string, params?: Record<string, string | number>) {
  const value = t(key, params);
  return value === key ? fallback : value;
}

function asNum(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  const vaultCount = num("vaultCount");
  const pendingCount = num("pendingCount");
  const completedCount = num("completedCount");
  const connectedAddress = str("connectedAddress");
  const connectedIsSigner = bool("connectedIsSigner");
  const connectedHasApproved = bool("connectedHasApproved");
  const activeVault = val<Record<string, unknown> | null>("activeVault", null);
  const activeRequest = val<Record<string, unknown> | null>("activeRequest", null);
  const unfundedNotice = str("unfundedNotice");
  const isCreatingVault = bool("isCreatingVault");
  const isDepositing = bool("isDepositing");
  const isProposing = bool("isProposing");
  const isApproving = bool("isApproving");
  const isCancelling = bool("isCancelling");
  const isLoading = bool("isLoading");
  const history = (val("history") ?? []) as Array<Record<string, unknown>>;

  const [vaultIdInput, setVaultIdInput] = useState("");

  const hasActiveRequest = Boolean(activeRequest);
  const busy = isApproving || isCancelling || isProposing || isCreatingVault || isDepositing || isLoading;
  const vaultId = asNum(activeVault?.id);
  const requestId = asNum(activeRequest?.id);
  const signers = Array.isArray(activeVault?.signers) ? activeVault.signers : [];
  const signerCount = signers.length || (connectedAddress ? 1 : 0);
  const threshold = asNum(activeVault?.threshold, signerCount > 1 ? 2 : 0);
  const approvalCount = asNum(activeRequest?.approvalCount, connectedHasApproved ? 1 : 0);
  const approvalTotal = Math.max(threshold || signerCount || 2, 1);
  const approvalPercent = hasActiveRequest
    ? Math.max(8, Math.min(100, Math.round((approvalCount / approvalTotal) * 100)))
    : Math.max(16, Math.min(100, Math.round(((threshold || 1) / Math.max(signerCount || 3, 1)) * 100)));
  const requestStatus = String(activeRequest?.status || (hasActiveRequest ? text(t, "statusPending", "Pending") : text(t, "multisigCreateReady", "Ready to deploy")));
  const vaultLabel = vaultId ? `Vault #${vaultId}` : text(t, "multisigVaultTitle", "Custody vault");
  const requestLabel = requestId ? `Request #${requestId}` : text(t, "multisigProposalPreview", "Proposal docket");
  const signerSummary = signerCount > 0
    ? `${signerCount} ${text(t, "multisigSignerList", "signers").toLowerCase()}`
    : text(t, "multisigNeedSigners", "Add at least two signer addresses");
  const thresholdSummary = threshold > 0
    ? `${threshold}/${Math.max(signerCount, threshold)} ${text(t, "multisigQuorumTitle", "threshold").toLowerCase()}`
    : text(t, "multisigQuorumTitle", "Threshold");

  const scene = (
    <div className="multisig-workbench" data-state={busy ? "active" : hasActiveRequest ? "request" : "idle"} data-approved={connectedHasApproved ? "true" : "false"}>
      <section className="multisig-vault-card" aria-label={text(t, "multisigVaultTitle", "Custody vault")}>
        <div className="multisig-vault-card__copy">
          <span><ShieldCheck size={15} /> {text(t, "multisigVaultBadge", "Vault")}</span>
          <strong>{vaultLabel}</strong>
          <p>{text(t, "multisigSignerCopy", "Only listed signer addresses can approve a spend. The contract releases funds at the threshold.")}</p>
          <div className="multisig-vault-card__chips">
            <em><UsersRound size={14} /> {signerSummary}</em>
            <em><KeyRound size={14} /> {thresholdSummary}</em>
          </div>
        </div>
        <div className="multisig-vault-card__art" aria-hidden="true">
          <img className="multisig-vault-card__image" src={VAULT_STAGE_IMAGE} alt="" />
          <div className="multisig-keyring">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={i < Math.min(signerCount || 1, 3) ? "is-lit" : undefined}>
                {i < Math.min(approvalCount || (connectedHasApproved ? 1 : 0), 3) ? <CheckCircle2 size={16} /> : <KeyRound size={16} />}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="multisig-approval-card" aria-label={text(t, "multisigApprovalBoard", "Approval board")}>
        <div className="multisig-approval-card__head">
          <span><FileSignature size={15} /> {requestLabel}</span>
          <strong>{requestStatus}</strong>
        </div>
        <div className="multisig-approval-meter" style={{ "--approval": `${approvalPercent}%` } as CSSProperties}>
          <div className="multisig-approval-meter__label">
            <span>{text(t, "approvalProgress", "Approval progress", { count: approvalCount, total: approvalTotal })}</span>
            <strong>{approvalCount}/{approvalTotal}</strong>
          </div>
          <div className="multisig-approval-meter__track">
            <div className="multisig-approval-meter__bar" />
          </div>
        </div>
        <div className="multisig-route">
          {[text(t, "multisigRouteCreate", "Create vault"), text(t, "multisigRouteSign", "Propose spend"), text(t, "multisigRouteBroadcast", "Approve & release")].map((label, index) => (
            <span key={label} className={index === 2 && hasActiveRequest ? "is-current" : undefined}>
              {index === 2 && hasActiveRequest ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />}
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="multisig-load-panel" aria-label={text(t, "multisigLoadTitle", "Load vault or request")}>
        <label>
          <span><Search size={14} /> {text(t, "loadVaultTitle", "Load vault")}</span>
          <input
            className="multisig-input"
            value={vaultIdInput}
            onChange={(e) => setVaultIdInput(e.target.value)}
            placeholder={text(t, "loadVaultPlaceholder", "Vault ID")}
            disabled={busy}
            onKeyDown={(e) => { if (e.key === "Enter") void dispatch("loadVault", vaultIdInput); }}
          />
        </label>
        <button type="button" className="multisig-load-panel__button" disabled={busy || !vaultIdInput.trim()} onClick={() => void dispatch("loadVault", vaultIdInput)}>
          {text(t, "loadButton", "Load")}
        </button>
        {unfundedNotice && <p className="multisig-workbench__notice" role="alert">{unfundedNotice}</p>}
      </section>
    </div>
  );

  return (
    <div className="neo-multisig-play-area mx2 mx2-cat-tool">
      <PlayStage category="tool" stage={{ eyebrow: t("appTitle"), title: hasActiveRequest ? t("buttonApprove") : t("appSubtitle"), subtitle: t("docDescription"), badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {vaultCount} vaults</span> }}
        scene={scene}
        score={[{ label: "Vaults", value: String(vaultCount), accent: true }, { label: "Pending", value: String(pendingCount) }, { label: "Completed", value: String(completedCount) }]}
        actions={{
          primary: hasActiveRequest && connectedIsSigner && !connectedHasApproved
            ? { label: isApproving ? t("buttonApproving") : t("buttonApprove"), onClick: () => void dispatch("approveRequest", activeRequest), loading: isApproving }
            : { label: t("buttonCreateVault"), onClick: () => void dispatch("createVault", {}), loading: isCreatingVault },
          secondary: [
            ...(hasActiveRequest ? [{ label: t("buttonPropose"), onClick: () => void dispatch("proposeRequest", {}), hint: t("buttonPropose") }] : []),
            ...(hasActiveRequest ? [{ label: t("buttonCancel"), onClick: () => void dispatch("cancelRequest", activeRequest), loading: isCancelling }] : []),
          ],
        }}
        drawerToggleLabel="History" drawer={{ title: "History", children: (
          <>
            <h4>History</h4>
            {history.length > 0 ? (
              <ul className="mx2-history">{history.slice(0, 10).map((item, i) => (
                <li key={i} className="mx2-history__item">
                  <span className="mx2-history__face">{String(item.kind || item.id || "—")}</span>
                  <span className="mx2-history__result">{String(item.status || "")}</span>
                </li>
              ))}</ul>
            ) : <p>No history.</p>}
            <h4>{t("buttonDeposit")}</h4>
            <p>{t("amountPlaceholder")}</p>
            <h4>{t("docFeature1Name")}</h4>
            <p>{t("docFeature1Desc")}</p>
          </>
        ) }}
      />
    </div>
  );
}
