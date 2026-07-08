/**
 * PlayArea.tsx — Neo Multisig (v3 production workflow)
 * The vault is the first-screen application surface; contract inputs live in the
 * drawer as complete workflows. Primary actions carry real draft payloads.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Coins,
  FileSignature,
  History,
  KeyRound,
  ListChecks,
  Minus,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import {
  OpenUiNotice,
  OpenUiPanel,
  OpenUiProvider,
  OpenUiSegmented,
  OpenUiTextArea,
  OpenUiTextField,
  PlayStage,
} from "@shared/components-react/v2";
import { CoinArt } from "@shared/art";
import {
  fromBaseUnits,
  isValidAddress,
  isValidAmount,
  MAX_SIGNERS,
  MIN_SIGNERS,
  type VaultAsset,
} from "./utils/vault";
import "./PlayArea.scss";

interface P { t: (k: string, p?: Record<string, string|number>) => string; state: ObservableState; dispatch: (n: string, ...a: unknown[]) => Promise<void>; }

const VAULT_STAGE_IMAGE = "multisig-vault-stage.webp";
const PROPOSAL_CARD_IMAGE = "multisig-proposal-card.webp";
type DrawerMode = "create" | "fund" | "spend" | "load" | "history";

function text(t: P["t"], key: string, fallback: string, params?: Record<string, string | number>) {
  const value = t(key, params);
  return value === key ? fallback : value;
}

function asNum(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parsePositiveId(value: unknown) {
  const id = Math.floor(Number(value));
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function normalizeAmountDraft(value: string, asset: VaultAsset) {
  const clean = value.replace(/[^\d.]/g, "");
  const [wholeRaw = "", ...fractionParts] = clean.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "");
  if (asset === "NEO") return whole;
  const fraction = fractionParts.join("").slice(0, 8);
  return clean.includes(".") ? `${whole || "0"}.${fraction}` : whole;
}

function stepAmountDraft(value: string, asset: VaultAsset, direction: -1 | 1) {
  const step = asset === "NEO" ? 1 : 0.25;
  const current = Number(value || "0");
  const next = Math.max(step, (Number.isFinite(current) ? current : 0) + step * direction);
  return asset === "NEO" ? String(Math.round(next)) : Number(next.toFixed(8)).toString();
}

function asAsset(value: unknown): VaultAsset {
  return value === "NEO" ? "NEO" : "GAS";
}

function short(value: unknown, head = 6, tail = 4) {
  const raw = String(value ?? "").trim();
  if (raw.length <= head + tail + 1) return raw || "—";
  return `${raw.slice(0, head)}…${raw.slice(-tail)}`;
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
  const isCreatingVault = bool("isCreatingVault");
  const isDepositing = bool("isDepositing");
  const isProposing = bool("isProposing");
  const isApproving = bool("isApproving");
  const isCancelling = bool("isCancelling");
  const isLoading = bool("isLoading");
  const history = (val("history") ?? []) as Array<Record<string, unknown>>;
  const rawUnfundedNotice = val<Record<string, unknown> | null>("unfundedNotice", null);
  const unfundedNotice = rawUnfundedNotice && typeof rawUnfundedNotice === "object" ? rawUnfundedNotice : null;

  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [signerDrafts, setSignerDrafts] = useState<string[]>(["", ""]);
  const [thresholdDraft, setThresholdDraft] = useState("2");
  const [depositVaultId, setDepositVaultId] = useState("");
  const [depositAsset, setDepositAsset] = useState<VaultAsset>("GAS");
  const [depositAmount, setDepositAmount] = useState("");
  const [proposalVaultId, setProposalVaultId] = useState("");
  const [proposalAsset, setProposalAsset] = useState<VaultAsset>("GAS");
  const [proposalRecipient, setProposalRecipient] = useState("");
  const [proposalAmount, setProposalAmount] = useState("");
  const [proposalMemo, setProposalMemo] = useState("");
  const [loadVaultIdInput, setLoadVaultIdInput] = useState("");
  const [loadRequestIdInput, setLoadRequestIdInput] = useState("");

  const hasActiveRequest = Boolean(activeRequest);
  const busy = isApproving || isCancelling || isProposing || isCreatingVault || isDepositing || isLoading;
  const vaultId = parsePositiveId(activeVault?.id);
  const requestId = parsePositiveId(activeRequest?.id);
  const signers = Array.isArray(activeVault?.signers) ? activeVault.signers.map(String) : [];
  const cleanSignerDrafts = signerDrafts.map((signer) => signer.trim()).filter(Boolean);
  const signerCount = signers.length || cleanSignerDrafts.length || (connectedAddress ? 1 : 0);
  const thresholdDraftValue = Math.floor(Number(thresholdDraft));
  const threshold = asNum(activeVault?.threshold, thresholdDraftValue > 0 ? thresholdDraftValue : signerCount > 1 ? 2 : 0);
  const approvalCount = asNum(activeRequest?.approvalCount, connectedHasApproved ? 1 : 0);
  const approvalTotal = Math.max(threshold || signerCount || 2, 1);
  const approvalPercent = hasActiveRequest
    ? Math.max(8, Math.min(100, Math.round((approvalCount / approvalTotal) * 100)))
    : Math.max(16, Math.min(100, Math.round(((threshold || 1) / Math.max(signerCount || 3, 1)) * 100)));
  const requestAsset = asAsset(activeRequest?.assetSymbol || activeRequest?.asset);
  const requestStatusKey = String(activeRequest?.status || "");
  const requestStatus = requestStatusKey
    ? text(t, `status${requestStatusKey[0]?.toUpperCase()}${requestStatusKey.slice(1)}`, requestStatusKey)
    : text(t, "multisigCreateReady", "Ready to deploy");
  const requestAmount = hasActiveRequest
    ? `${fromBaseUnits(asNum(activeRequest?.amount), requestAsset)} ${requestAsset}`
    : text(t, "multisigAmountPreview", "Amount to release");
  const requestRecipient = hasActiveRequest
    ? short(activeRequest?.recipient, 8, 6)
    : text(t, "multisigRecipientPreview", "Recipient pending");
  const vaultLabel = vaultId ? `Vault #${vaultId}` : text(t, "multisigVaultTitle", "Custody vault");
  const requestLabel = requestId ? `Request #${requestId}` : text(t, "multisigProposalPreview", "Proposal docket");
  const signerSummary = signerCount > 0
    ? `${signerCount} ${text(t, "multisigSignerList", "signers").toLowerCase()}`
    : text(t, "multisigNeedSigners", "Add at least two signer addresses");
  const thresholdSummary = threshold > 0
    ? `${threshold}/${Math.max(signerCount, threshold)} ${text(t, "multisigQuorumTitle", "threshold").toLowerCase()}`
    : text(t, "multisigQuorumTitle", "Threshold");
  const displayedSigners = (signers.length > 0 ? signers : cleanSignerDrafts).slice(0, 4);
  const gasBalance = fromBaseUnits(asNum(activeVault?.gasBalance), "GAS");
  const neoBalance = fromBaseUnits(asNum(activeVault?.neoBalance), "NEO");
  const createSignersUnique = new Set(cleanSignerDrafts).size === cleanSignerDrafts.length;
  const createSignersReady = cleanSignerDrafts.length >= MIN_SIGNERS && cleanSignerDrafts.length <= MAX_SIGNERS && cleanSignerDrafts.every(isValidAddress) && createSignersUnique;
  const thresholdReady = Number.isInteger(thresholdDraftValue) && thresholdDraftValue > 0 && thresholdDraftValue <= cleanSignerDrafts.length;
  const createReady = createSignersReady && thresholdReady;
  const createHint = cleanSignerDrafts.length < MIN_SIGNERS
    ? text(t, "multisigNeedSigners", "Add at least two signer addresses before creating a vault.")
    : cleanSignerDrafts.length > MAX_SIGNERS
      ? text(t, "multisigTooManySigners", "A vault supports at most 16 signer addresses.")
      : !cleanSignerDrafts.every(isValidAddress)
        ? text(t, "multisigInvalidSignerAddress", "Each signer must be a valid Neo N3 address.")
        : !createSignersUnique
          ? text(t, "multisigDuplicateSigners", "Signer addresses must be distinct.")
          : !thresholdReady
            ? text(t, "multisigThresholdBlocked", "Threshold cannot be greater than the number of signers.")
            : text(t, "multisigCreateReady", "Ready to deploy an on-chain custody vault.");
  const createPayload = { signers: cleanSignerDrafts, threshold: thresholdDraftValue };
  const depositTargetVault = parsePositiveId(depositVaultId || vaultId);
  const depositReady = depositTargetVault > 0 && isValidAmount(depositAmount, depositAsset);
  const depositPayload = { vaultId: depositTargetVault, asset: depositAsset, amount: depositAmount.trim() };
  const proposalTargetVault = parsePositiveId(proposalVaultId || vaultId);
  const proposalReady = proposalTargetVault > 0 && isValidAddress(proposalRecipient) && isValidAmount(proposalAmount, proposalAsset);
  const proposalPayload = {
    vaultId: proposalTargetVault,
    asset: proposalAsset,
    recipient: proposalRecipient.trim(),
    amount: proposalAmount.trim(),
    memo: proposalMemo.trim(),
  };
  const canApprove = hasActiveRequest && requestId > 0 && connectedIsSigner && !connectedHasApproved;
  const canCancel = hasActiveRequest && requestId > 0 && connectedIsSigner;
  const activeRouteIndex = hasActiveRequest ? 2 : vaultId > 0 ? 1 : 0;
  const balanceFor = (asset: VaultAsset) => (asset === "NEO" ? neoBalance : gasBalance);
  const quickAmounts = (asset: VaultAsset) => (asset === "NEO" ? ["1", "5", "10"] : ["0.25", "1", "5"]);

  useEffect(() => {
    if (!connectedAddress) return;
    setSignerDrafts((current) => current.some((signer) => signer.trim()) ? current : [connectedAddress, ""]);
  }, [connectedAddress]);

  useEffect(() => {
    if (vaultId <= 0) return;
    setDepositVaultId(String(vaultId));
    setProposalVaultId(String(vaultId));
  }, [vaultId]);

  const setSignerAt = (index: number, value: string) => {
    setSignerDrafts((current) => current.map((signer, i) => i === index ? value : signer));
  };

  const addSigner = () => {
    setSignerDrafts((current) => current.length >= MAX_SIGNERS ? current : [...current, ""]);
  };

  const removeSigner = (index: number) => {
    setSignerDrafts((current) => current.length <= MIN_SIGNERS ? current : current.filter((_, i) => i !== index));
  };

  const setDrawerModeSafe = (mode: string) => {
    if (["create", "fund", "spend", "load", "history"].includes(mode)) {
      setDrawerMode(mode as DrawerMode);
    }
  };

  const setDepositAssetSafe = (asset: VaultAsset) => {
    setDepositAsset(asset);
    setDepositAmount((current) => normalizeAmountDraft(current, asset));
  };

  const setProposalAssetSafe = (asset: VaultAsset) => {
    setProposalAsset(asset);
    setProposalAmount((current) => normalizeAmountDraft(current, asset));
  };

  const renderAssetToggle = (value: VaultAsset, onChange: (asset: VaultAsset) => void, label: string) => (
    <div className="multisig-asset-toggle" aria-label={label}>
      {(["GAS", "NEO"] as VaultAsset[]).map((asset) => (
        <button
          key={asset}
          type="button"
          data-active={value === asset ? "true" : undefined}
          onClick={() => onChange(asset)}
        >
          <Coins size={15} />
          <span>{asset}</span>
          <em>{asset === "GAS" ? text(t, "multisigGasAssetHint", "Fee token, 8 decimals") : text(t, "multisigNeoAssetHint", "Whole-token custody")}</em>
        </button>
      ))}
    </div>
  );

  const renderAmountConsole = (
    asset: VaultAsset,
    value: string,
    onChange: (value: string) => void,
    label: string,
    hint: string,
    className: string,
    maxAmount?: string,
  ) => {
    const valueNumber = Number(value || "0");
    return (
      <div className={`multisig-amount-console ${className}`} role="group" aria-label={label} data-asset={asset}>
        <div className="multisig-amount-console__asset">
          <CoinArt size={30} variant={asset.toLowerCase() as "gas" | "neo"} decorative />
          <span>{asset}</span>
          <strong>{value || "0"}</strong>
        </div>
        <div className="multisig-amount-console__stepper">
          <button type="button" aria-label={text(t, "multisigDecreaseAmount", "Decrease amount")} disabled={valueNumber <= (asset === "NEO" ? 1 : 0.25)} onClick={() => onChange(stepAmountDraft(value, asset, -1))}>
            <Minus size={14} />
          </button>
          <label className="multisig-amount-console__input">
            <span>{label}</span>
            <input value={value} inputMode={asset === "NEO" ? "numeric" : "decimal"} onChange={(event) => onChange(normalizeAmountDraft(event.target.value, asset))} />
          </label>
          <button type="button" aria-label={text(t, "multisigIncreaseAmount", "Increase amount")} onClick={() => onChange(stepAmountDraft(value, asset, 1))}>
            <Plus size={14} />
          </button>
        </div>
        <div className="multisig-amount-console__quick" aria-label={text(t, "multisigQuickAmount", "Quick amounts")}>
          {quickAmounts(asset).map((preset) => (
            <button key={preset} type="button" onClick={() => onChange(preset)}>{preset}</button>
          ))}
          {maxAmount && Number(maxAmount) > 0 && (
            <button type="button" onClick={() => onChange(normalizeAmountDraft(maxAmount, asset))}>
              {text(t, "multisigUseVaultBalance", "Max")}
            </button>
          )}
        </div>
        <small>{hint}</small>
      </div>
    );
  };

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
          <div className="multisig-signer-board" aria-label={text(t, "multisigSignerRoster", "Signer roster")}>
            {displayedSigners.length > 0 ? displayedSigners.map((signer, index) => (
              <span key={`${signer}-${index}`}>
                <small>{index + 1}</small>
                <strong>{short(signer)}</strong>
              </span>
            )) : (
              <span className="is-empty">
                <small>0</small>
                <strong>{text(t, "multisigNeedSigners", "Add at least two signer addresses")}</strong>
              </span>
            )}
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
            <span key={label} className={index === activeRouteIndex ? "is-current" : undefined}>
              {index < activeRouteIndex ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />}
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="multisig-load-panel" aria-label={text(t, "multisigLoadTitle", "Load vault or request")}>
        <div className="multisig-load-panel__copy">
          <span><Search size={14} /> {text(t, "multisigLoadTitle", "Load vault or request")}</span>
          <strong>{vaultId ? vaultLabel : text(t, "multisigLoadCopy", "Have a vault or request ID? Load it to deposit, propose, or approve.")}</strong>
          <em>{connectedAddress ? `${text(t, "multisigConnectedAs", "Connected as")} ${short(connectedAddress, 8, 6)}` : text(t, "multisigNotConnected", "Connect a wallet to create or sign")}</em>
        </div>
        <div className="multisig-balance-strip" aria-label={text(t, "multisigBalanceTitle", "Vault balance")}>
          <span><strong>{gasBalance}</strong><small>GAS</small></span>
          <span><strong>{neoBalance}</strong><small>NEO</small></span>
        </div>
        {unfundedNotice && (
          <p className="multisig-workbench__notice" role="alert">
            {text(t, "multisigUnfundedNotice", "Auto-cancelled at threshold: the vault was underfunded.", {
              required: String(unfundedNotice.required ?? "0"),
              available: String(unfundedNotice.available ?? "0"),
              asset: String(unfundedNotice.asset ?? "GAS"),
            })}
          </p>
        )}
      </section>
    </div>
  );

  const drawerModes: Array<{ mode: DrawerMode; label: string; value: string; icon: ReactNode }> = [
    { mode: "create", label: text(t, "buttonCreateVault", "Create Vault"), value: createReady ? text(t, "multisigCreateReady", "Ready") : `${cleanSignerDrafts.length}/${MIN_SIGNERS}`, icon: <UsersRound size={16} /> },
    { mode: "fund", label: text(t, "buttonDeposit", "Deposit"), value: vaultId ? vaultLabel : text(t, "multisigVaultIdLabel", "Vault ID"), icon: <WalletCards size={16} /> },
    { mode: "spend", label: text(t, "buttonPropose", "Propose Spend"), value: proposalReady ? `${proposalAmount} ${proposalAsset}` : text(t, "multisigProposalPreview", "Proposal docket"), icon: <Send size={16} /> },
    { mode: "load", label: text(t, "multisigLoadTitle", "Load vault or request"), value: requestId ? requestLabel : text(t, "loadButton", "Load"), icon: <Search size={16} /> },
    { mode: "history", label: text(t, "recentTitle", "Recent Activity"), value: String(history.length), icon: <History size={16} /> },
  ];
  const activeDrawer = drawerModes.find((item) => item.mode === drawerMode) ?? drawerModes[0]!;

  const drawerPanels: Record<DrawerMode, ReactNode> = {
    create: (
      <div className="multisig-drawer-flow">
        <div className="multisig-signer-stack">
          {signerDrafts.map((signer, index) => (
            <div className="multisig-signer-row" key={index}>
              <OpenUiTextField
                className="multisig-signer-input"
                label={`${text(t, "signerLabel", "Signer Address")} ${index + 1}`}
                value={signer}
                onChange={(event) => setSignerAt(index, event.target.value)}
                placeholder={text(t, "signerPlaceholder", "Neo N3 address (N...)")}
                mono
              />
              <button
                type="button"
                className="multisig-icon-button"
                disabled={signerDrafts.length <= MIN_SIGNERS}
                onClick={() => removeSigner(index)}
                aria-label={text(t, "multisigRemoveSigner", "Remove signer")}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button type="button" className="multisig-drawer-add" disabled={signerDrafts.length >= MAX_SIGNERS} onClick={addSigner}>
            <Plus size={15} />
            <span>{text(t, "multisigAddSigner", "+ Add signer")}</span>
          </button>
        </div>
        <OpenUiTextField
          className="multisig-threshold-input"
          label={text(t, "thresholdLabel", "Approval Threshold")}
          value={thresholdDraft}
          onChange={(event) => setThresholdDraft(event.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          mono
        />
        <OpenUiNotice type={createReady ? "success" : "warning"} title={createHint}>
          <span>{text(t, "multisigVaultCopy", "Enter 2-16 signer addresses and a threshold to deploy a shared custody vault on-chain.")}</span>
        </OpenUiNotice>
        <button type="button" className="multisig-drawer-action" disabled={busy || !createReady} onClick={() => void dispatch("createVault", createPayload)}>
          <ShieldCheck size={16} />
          <span>{isCreatingVault ? text(t, "buttonCreateVault", "Create Vault") : text(t, "buttonCreateVault", "Create Vault")}</span>
        </button>
      </div>
    ),
    fund: (
      <div className="multisig-drawer-flow">
        <div className="multisig-balance-board">
          <span><strong>{gasBalance}</strong><small>GAS</small></span>
          <span><strong>{neoBalance}</strong><small>NEO</small></span>
        </div>
        <div className="multisig-target-card">
          <div className="multisig-target-card__summary">
            <WalletCards size={18} />
            <span>{text(t, "multisigDepositVaultTarget", "Deposit target")}</span>
            <strong>{depositTargetVault ? `Vault #${depositTargetVault}` : text(t, "loadVaultPlaceholder", "Vault ID")}</strong>
          </div>
          <OpenUiTextField
            className="multisig-drawer-field multisig-target-card__input"
            label={text(t, "multisigVaultIdLabel", "Vault ID")}
            value={depositVaultId}
            onChange={(event) => setDepositVaultId(event.target.value.replace(/[^\d]/g, ""))}
            placeholder={text(t, "loadVaultPlaceholder", "Vault ID")}
            inputMode="numeric"
            mono
          />
        </div>
        {renderAssetToggle(depositAsset, setDepositAssetSafe, text(t, "assetLabel", "Asset"))}
        {renderAmountConsole(
          depositAsset,
          depositAmount,
          setDepositAmount,
          text(t, "multisigDepositAmountControl", "Deposit amount"),
          text(t, "multisigDepositAmountHint", "Paid from the connected wallet into this vault."),
          "multisig-deposit-amount",
        )}
        <button type="button" className="multisig-drawer-action" disabled={busy || !depositReady} onClick={() => void dispatch("deposit", depositPayload)}>
          <WalletCards size={16} />
          <span>{text(t, "buttonDeposit", "Deposit")}</span>
        </button>
      </div>
    ),
    spend: (
      <div className="multisig-drawer-flow multisig-drawer-flow--split">
        <div className="multisig-proposal-art" aria-hidden="true">
          <img src={PROPOSAL_CARD_IMAGE} alt="" />
        </div>
        <div className="multisig-spend-ticket">
          <div className="multisig-ticket-grid">
            <div className="multisig-target-card">
              <div className="multisig-target-card__summary">
                <WalletCards size={18} />
                <span>{text(t, "multisigVaultIdLabel", "Vault ID")}</span>
                <strong>{proposalTargetVault ? `Vault #${proposalTargetVault}` : text(t, "loadVaultPlaceholder", "Vault ID")}</strong>
              </div>
              <OpenUiTextField
                className="multisig-drawer-field multisig-target-card__input"
                label={text(t, "multisigVaultIdLabel", "Vault ID")}
                value={proposalVaultId}
                onChange={(event) => setProposalVaultId(event.target.value.replace(/[^\d]/g, ""))}
                placeholder={text(t, "loadVaultPlaceholder", "Vault ID")}
                inputMode="numeric"
                mono
              />
            </div>
            <div className="multisig-recipient-card" data-valid={isValidAddress(proposalRecipient) ? "true" : undefined}>
              <div className="multisig-recipient-card__summary">
                <Send size={18} />
                <span>{text(t, "multisigRecipientTicket", "Recipient")}</span>
                <strong>{proposalRecipient ? short(proposalRecipient, 8, 6) : text(t, "multisigRecipientPreview", "Recipient pending")}</strong>
              </div>
              <OpenUiTextField
                className="multisig-drawer-field multisig-recipient-card__input"
                label={text(t, "toAddressLabel", "Recipient Address")}
                value={proposalRecipient}
                onChange={(event) => setProposalRecipient(event.target.value)}
                placeholder={text(t, "toAddressPlaceholder", "N3 address")}
                mono
              />
            </div>
          </div>
          {renderAssetToggle(proposalAsset, setProposalAssetSafe, text(t, "assetLabel", "Asset"))}
          {renderAmountConsole(
            proposalAsset,
            proposalAmount,
            setProposalAmount,
            text(t, "multisigSpendAmountControl", "Spend amount"),
            text(t, "multisigSpendAmountHint", "{balance} {asset} in this vault before pending requests.", { balance: balanceFor(proposalAsset), asset: proposalAsset }),
            "multisig-spend-amount",
            balanceFor(proposalAsset),
          )}
          <OpenUiTextArea
            className="multisig-drawer-field multisig-memo-ticket"
            label={text(t, "memoLabel", "Memo (optional)")}
            value={proposalMemo}
            onChange={(event) => setProposalMemo(event.target.value)}
            placeholder={text(t, "memoPlaceholder", "Short note for signers")}
          />
          <OpenUiNotice type="info" title={text(t, "multisigPooledBalanceNote", "Vault balance is shared across all pending requests.")} />
          <button type="button" className="multisig-drawer-action" disabled={busy || !proposalReady} onClick={() => void dispatch("proposeRequest", proposalPayload)}>
            <Send size={16} />
            <span>{text(t, "buttonPropose", "Propose Spend")}</span>
          </button>
        </div>
      </div>
    ),
    load: (
      <div className="multisig-drawer-flow multisig-load-grid">
        <div>
          <OpenUiTextField
            className="multisig-drawer-field multisig-load-vault-input"
            label={text(t, "loadVaultTitle", "Load vault")}
            value={loadVaultIdInput}
            onChange={(event) => setLoadVaultIdInput(event.target.value.replace(/[^\d]/g, ""))}
            placeholder={text(t, "loadVaultPlaceholder", "Vault ID")}
            inputMode="numeric"
            mono
          />
          <button type="button" className="multisig-drawer-action" disabled={busy || parsePositiveId(loadVaultIdInput) <= 0} onClick={() => void dispatch("loadVault", loadVaultIdInput)}>
            <Search size={16} />
            <span>{text(t, "loadButton", "Load")}</span>
          </button>
        </div>
        <div>
          <OpenUiTextField
            className="multisig-drawer-field multisig-load-request-input"
            label={text(t, "loadRequestTitle", "Load request")}
            value={loadRequestIdInput}
            onChange={(event) => setLoadRequestIdInput(event.target.value.replace(/[^\d]/g, ""))}
            placeholder={text(t, "loadRequestPlaceholder", "Request ID")}
            inputMode="numeric"
            mono
          />
          <button type="button" className="multisig-drawer-action" disabled={busy || parsePositiveId(loadRequestIdInput) <= 0} onClick={() => void dispatch("loadRequest", loadRequestIdInput)}>
            <FileSignature size={16} />
            <span>{text(t, "loadButton", "Load")}</span>
          </button>
        </div>
      </div>
    ),
    history: (
      <div className="multisig-drawer-flow">
        {hasActiveRequest && (
          <OpenUiNotice type="info" title={text(t, "multisigShareRequestId", "Share this request ID with the other signers so they can load and approve it.")}>
            <code>{requestId || "—"}</code>
          </OpenUiNotice>
        )}
        {history.length > 0 ? (
          <ul className="mx2-history multisig-history">
            {history.slice(0, 10).map((item, i) => (
              <li key={i} className="mx2-history__item">
                <span className="mx2-history__face">{String(item.label || item.kind || item.id || "—")}</span>
                <span className="mx2-history__result">{String(item.status || "")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="multisig-empty-state">
            <ListChecks size={22} />
            <strong>{text(t, "recentEmpty", "No vaults or requests yet.")}</strong>
          </div>
        )}
      </div>
    ),
  };

  const secondaryActions = hasActiveRequest
    ? [
        { label: isCancelling ? text(t, "buttonCancelling", "Cancelling...") : text(t, "buttonCancel", "Cancel"), onClick: () => void dispatch("cancelRequest", requestId), loading: isCancelling, disabled: !canCancel || busy, hint: canCancel ? undefined : text(t, "multisigNotSignerHint", "Only the vault's signer addresses can approve or cancel this request.") },
      ]
    : [
        { label: text(t, "buttonDeposit", "Deposit"), onClick: () => void dispatch("deposit", depositPayload), loading: isDepositing, disabled: !depositReady || busy, hint: depositReady ? undefined : text(t, "toastInvalidAmount", "Invalid amount.") },
        { label: text(t, "buttonPropose", "Propose Spend"), onClick: () => void dispatch("proposeRequest", proposalPayload), loading: isProposing, disabled: !proposalReady || busy, hint: proposalReady ? undefined : text(t, "toastInvalidAddress", "Invalid address.") },
      ];

  return (
    <OpenUiProvider>
      <div className="neo-multisig-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: text(t, "multisigHeroEyebrow", "On-chain custody"),
            title: hasActiveRequest ? requestLabel : vaultLabel,
            subtitle: hasActiveRequest
              ? `${requestAmount} · ${requestRecipient}`
              : text(t, "multisigHeroSubtitle", "Deposit GAS or NEO into a shared vault, propose a spend, and release funds once the approval threshold is met."),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {vaultCount} {text(t, "sidebarTotalTxs", "Vaults").toLowerCase()}</span>,
          }}
          scene={scene}
          score={[{ label: text(t, "sidebarTotalTxs", "Vaults"), value: String(vaultCount), accent: true }, { label: text(t, "statPending", "Pending"), value: String(pendingCount) }, { label: text(t, "statCompleted", "Executed"), value: String(completedCount) }]}
          actions={{
            primary: hasActiveRequest
              ? { label: isApproving ? text(t, "buttonApproving", "Approving...") : text(t, "buttonApprove", "Approve"), onClick: () => void dispatch("approveRequest", requestId), loading: isApproving, disabled: !canApprove || busy, hint: connectedHasApproved ? text(t, "multisigAlreadyApprovedHint", "You have already approved this request.") : !connectedIsSigner ? text(t, "multisigNotSignerHint", "Only the vault's signer addresses can approve or cancel this request.") : undefined }
              : { label: text(t, "buttonCreateVault", "Create Vault"), onClick: () => void dispatch("createVault", createPayload), loading: isCreatingVault, disabled: !createReady || busy, hint: createHint },
            secondary: secondaryActions,
          }}
          drawerToggleLabel={text(t, "multisigLoadTitle", "Vault tools")}
          drawer={{
            title: text(t, "multisigLoadTitle", "Vault tools"),
            children: (
              <div className="multisig-drawer">
                <OpenUiSegmented
                  className="multisig-drawer-tabs"
                  segmentedClassName="multisig-drawer-tabs__group"
                  label={text(t, "multisigLoadTitle", "Vault tools")}
                  value={drawerMode}
                  onChange={setDrawerModeSafe}
                  options={drawerModes.map((item) => ({
                    value: item.mode,
                    label: (
                      <span className="multisig-drawer-tab">
                        {item.icon}
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </span>
                    ),
                  }))}
                />
                <OpenUiPanel
                  className="multisig-drawer__panel"
                  icon={activeDrawer.icon}
                  title={activeDrawer.label}
                  subtitle={activeDrawer.value}
                >
                  <div className="multisig-drawer__panel-body" data-mode={drawerMode}>
                    {drawerPanels[drawerMode]}
                  </div>
                </OpenUiPanel>
              </div>
            ),
          }}
        />
      </div>
    </OpenUiProvider>
  );
}
