import { useState, type ReactElement } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { amountToBaseUnits } from "@shared/utils/amounts";
import { CoinArt } from "@shared/art";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiSegmented, OpenUiTextArea, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import { BadgeCheck, Info, ListChecks, LockKeyhole, Plus, Route, ShieldCheck, SlidersHorizontal, UserRound, WalletCards, X } from "lucide-react";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface EscrowItem {
  id: string;
  status: string;
  title?: string;
  beneficiary?: string;
  creator?: string;
  assetSymbol?: string;
  totalAmount?: bigint | number;
  milestoneAmounts?: Array<bigint | number>;
  milestoneApproved?: boolean[];
  milestoneClaimed?: boolean[];
  [key: string]: unknown;
}

type StationMode = "setup" | "preview" | "safety";
type DrawerMode = "setup" | "created" | "beneficiary";

function formatBaseUnits(amount: bigint, asset: string): string {
  if (asset === "NEO") return `${amount} NEO`;
  const gas = Number(amount) / 1e8;
  return `${gas.toFixed(4).replace(/\.?0+$/, "")} GAS`;
}

function asBaseUnits(value: bigint | number | undefined): bigint {
  if (value == null) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function normalizeAmountForAsset(value: string, asset: "GAS" | "NEO"): string {
  const text = String(value ?? "");
  if (asset === "NEO") {
    return text.split(/[.,]/)[0].replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  }
  return text.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const hasAddress = Boolean(state.address?.get());
  const contractReady = bool("contractReady");
  const isCreating = bool("isCreating");
  const approvingId = str("approvingId");
  const claimingId = str("claimingId");
  const cancellingId = str("cancellingId");
  const activeCount = num("activeCount");
  const completedCount = num("completedCount");
  const creatorEscrows = (val("creatorEscrows") ?? []) as EscrowItem[];
  const beneficiaryEscrows = (val("beneficiaryEscrows") ?? []) as EscrowItem[];
  const formatAddress = (val("formatAddressFunc") as ((address: string) => string) | undefined) ?? ((address: string) => address);
  const statusLabel = (val("statusLabelFunc") as ((status: string) => string) | undefined) ?? ((status: string) => status);

  const MIN_MILESTONES = 1;
  const MAX_MILESTONES = 12;
  const [escrowName, setEscrowName] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [asset, setAsset] = useState<"GAS" | "NEO">("GAS");
  const [milestoneAmounts, setMilestoneAmounts] = useState<string[]>([""]);
  const [description, setDescription] = useState("");
  const [stationMode, setStationMode] = useState<StationMode>("setup");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("setup");

  const parseAmount = (raw: string): bigint => amountToBaseUnits(String(raw ?? "").trim(), asset);
  const totalAmount = milestoneAmounts.reduce((sum, amt) => sum + parseAmount(amt), 0n);
  const allAmountsPositive = milestoneAmounts.every((a) => parseAmount(a) > 0n);
  const canSubmit = hasAddress && contractReady && beneficiary.trim() !== "" && allAmountsPositive && !isCreating;
  const totalDisplay = formatBaseUnits(totalAmount, asset);
  const beneficiaryPreview = beneficiary.trim() ? formatAddress(beneficiary.trim()) : t("beneficiaryPlaceholder");
  const fundedMilestones = milestoneAmounts.filter((amount) => parseAmount(amount) > 0n).length;
  const releaseSteps = [
    {
      key: "asset",
      label: t("fundingAsset"),
      value: asset,
      complete: true,
      icon: <LockKeyhole size={15} aria-hidden="true" />,
    },
    {
      key: "beneficiary",
      label: t("beneficiary"),
      value: beneficiary.trim() ? formatAddress(beneficiary.trim()) : t("recipientPending"),
      complete: beneficiary.trim() !== "",
      icon: <UserRound size={15} aria-hidden="true" />,
    },
    {
      key: "tranches",
      label: t("releaseTranches"),
      value: t("trancheCount", { done: fundedMilestones, count: milestoneAmounts.length }),
      complete: allAmountsPositive,
      icon: <Route size={15} aria-hidden="true" />,
    },
  ];
  const stationModes: Array<{ mode: StationMode; label: string; meta: string; icon: ReactElement }> = [
    { mode: "setup", label: t("stationSetupTab"), meta: t("stationSetupMeta"), icon: <SlidersHorizontal size={15} aria-hidden="true" /> },
    { mode: "preview", label: t("stationPreviewTab"), meta: totalAmount > 0n ? totalDisplay : t("previewPending"), icon: <Route size={15} aria-hidden="true" /> },
    { mode: "safety", label: t("stationSafetyTab"), meta: t("stationSafetyMeta"), icon: <ShieldCheck size={15} aria-hidden="true" /> },
  ];
  const drawerModes: Array<{ mode: DrawerMode; label: string; meta: string; icon: ReactElement }> = [
    { mode: "setup", label: t("setupPlan"), meta: canSubmit ? t("readyToSign") : t("needsSetup"), icon: <SlidersHorizontal size={15} aria-hidden="true" /> },
    { mode: "created", label: t("createdByYou"), meta: String(creatorEscrows.length), icon: <LockKeyhole size={15} aria-hidden="true" /> },
    { mode: "beneficiary", label: t("forYou"), meta: String(beneficiaryEscrows.length), icon: <UserRound size={15} aria-hidden="true" /> },
  ];

  const handleCreate = async () => {
    if (!canSubmit) return;
    const ok = (await dispatch("createEscrow", {
      name: escrowName.trim(),
      beneficiary: beneficiary.trim(),
      asset,
      notes: description.trim(),
      milestones: milestoneAmounts.map((amount) => ({ amount: amount.trim() })),
    })) as unknown as boolean;
    if (ok) {
      setEscrowName("");
      setBeneficiary("");
      setAsset("GAS");
      setMilestoneAmounts([""]);
      setDescription("");
    }
  };

  const handlePrimary = async () => {
    if (!hasAddress) {
      await dispatch("connectWallet");
      return;
    }
    await handleCreate();
  };

  const addMilestone = () => {
    setMilestoneAmounts((p) => (p.length < MAX_MILESTONES ? [...p, ""] : p));
  };

  const selectAsset = (nextAsset: "GAS" | "NEO") => {
    setAsset(nextAsset);
    setMilestoneAmounts((prev) => prev.map((amount) => normalizeAmountForAsset(amount, nextAsset)));
  };

  const updateMilestoneAmount = (index: number, value: string) => {
    setMilestoneAmounts((prev) => prev.map((amount, i) => (i === index ? normalizeAmountForAsset(value, asset) : amount)));
  };

  const removeMilestone = (index: number) => {
    setMilestoneAmounts((prev) => (prev.length > MIN_MILESTONES ? prev.filter((_, i) => i !== index) : prev));
  };

  const primaryLabel = !hasAddress
    ? t("connectWallet")
    : !contractReady
      ? t("deploymentPendingTitle")
      : isCreating
        ? t("twoStepSignBadge")
        : t("createEscrow");

  const primaryHint = !hasAddress
    ? t("connectToStart")
    : !contractReady
      ? t("deploymentPendingDesc")
      : canSubmit
        ? t("twoStepSignNotice", { asset })
        : t("dealControlsHint");

  const milestoneEditor = (surface: "station" | "drawer") => (
    <section className={`escrow-release-editor escrow-release-editor--${surface}`} aria-label={t("releaseTranches")}>
      <header className="escrow-release-editor__head">
        <div>
          <span>{t("releaseTranches")}</span>
          <strong>{t("trancheCount", { done: fundedMilestones, count: milestoneAmounts.length })}</strong>
        </div>
        <em>{asset === "NEO" ? t("assetNeoHint") : t("assetGasHint")}</em>
      </header>
      <div className="escrow-route" role="list" aria-label={t("milestonesLabel")}>
        {milestoneAmounts.map((amount, index) => {
          const funded = parseAmount(amount) > 0n;
          return (
            <div className="escrow-route__segment" role="listitem" key={index}>
              {index > 0 && <span className="escrow-route__pipe" aria-hidden="true" />}
              <label className="escrow-gate" data-filled={funded ? "true" : undefined}>
                <span className="escrow-gate__topline">
                  <span>{t("milestoneNumber", { n: index + 1 })}</span>
                  <em>{funded ? t("fundedGate") : t("draftGate")}</em>
                </span>
                <span className="escrow-gate__input-wrap">
                  <input
                    className="escrow-gate__input"
                    value={amount}
                    onChange={(e) => updateMilestoneAmount(index, e.target.value)}
                    placeholder={t("milestoneAmountPlaceholder")}
                    inputMode={asset === "NEO" ? "numeric" : "decimal"}
                    disabled={isCreating || !contractReady}
                  />
                  <span className="escrow-gate__asset">{asset}</span>
                </span>
                {milestoneAmounts.length > MIN_MILESTONES && (
                  <button
                    type="button"
                    className="escrow-gate__remove"
                    onClick={() => removeMilestone(index)}
                    disabled={isCreating}
                    aria-label={t("removeMilestone", { index: index + 1 })}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </label>
            </div>
          );
        })}
        {milestoneAmounts.length < MAX_MILESTONES && (
          <button type="button" className="escrow-gate escrow-gate--add" onClick={addMilestone} disabled={isCreating || !contractReady}>
            <span className="escrow-gate__plus" aria-hidden="true"><Plus size={18} /></span>
            <span>{t("addMilestone")}</span>
          </button>
        )}
      </div>
    </section>
  );

  const scene = (
    <div className="escrow-workbench" data-state={isCreating ? "creating" : canSubmit ? "ready" : "draft"}>
      <section className="escrow-vault-card" aria-label={t("releaseWorkbench")}>
        <img className="escrow-vault-card__image" src="./milestone-escrow-stage.webp" alt={t("releaseWorkbenchTitle")} />
        <div className="escrow-vault" aria-live="polite">
          <span className="escrow-vault__label">{t("releaseWorkbench")}</span>
          <span className="escrow-vault__amount">
            <CoinArt size={28} variant={asset === "GAS" ? "gas" : "neo"} />
            <strong>{totalDisplay}</strong>
          </span>
          <span className="escrow-vault__route">{beneficiaryPreview}</span>
        </div>
      </section>

      <section className="escrow-station" aria-label={t("escrowStation")}>
        <header className="escrow-station__head">
          <div>
            <span>{t("escrowStation")}</span>
            <strong>{stationMode === "setup" ? t("stationSetupTitle") : stationMode === "preview" ? t("stationPreviewTitle") : t("stationSafetyTitle")}</strong>
          </div>
          <Info size={17} aria-hidden="true" />
        </header>

        <div className="escrow-station-tabs" role="tablist" aria-label={t("stationTabs")}>
          {stationModes.map((item) => (
            <button
              key={item.mode}
              type="button"
              role="tab"
              aria-selected={stationMode === item.mode}
              className={stationMode === item.mode ? "is-active" : undefined}
              onClick={() => setStationMode(item.mode)}
            >
              {item.icon}
              <span>{item.label}</span>
              <em>{item.meta}</em>
            </button>
          ))}
        </div>

        {stationMode === "setup" && (
          <div className="escrow-station__panel escrow-station__panel--setup">
            <div className="escrow-swap-stack" aria-label={t("setupPlan")}>
              <div className="escrow-token-row escrow-token-row--asset">
                <span className="escrow-token-row__label">{t("fundingAsset")}</span>
                <div className="escrow-asset-dock" role="radiogroup" aria-label={t("assetType")}>
                  {(["GAS", "NEO"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      role="radio"
                      aria-checked={asset === a}
                      className="escrow-asset-card"
                      data-active={asset === a ? "true" : undefined}
                      onClick={() => selectAsset(a)}
                      disabled={isCreating}
                    >
                      <CoinArt size={22} variant={a === "GAS" ? "gas" : "neo"} />
                      <span>{a}</span>
                    </button>
                  ))}
                </div>
                <strong>{totalDisplay}</strong>
              </div>
              <span className="escrow-flow-glyph" aria-hidden="true"><Route size={18} /></span>
              <label className="escrow-token-row escrow-token-row--beneficiary">
                <span className="escrow-token-row__label">{t("beneficiary")}</span>
                <span className="escrow-token-row__identity">
                  <UserRound size={16} aria-hidden="true" />
                  <input
                    className="escrow-recipient-input"
                    value={beneficiary}
                    onChange={(e) => setBeneficiary(e.target.value)}
                    placeholder={t("beneficiaryPlaceholder")}
                    spellCheck={false}
                    disabled={isCreating || !contractReady}
                  />
                </span>
                <strong>{beneficiary.trim() ? t("recipientReady") : t("recipientPending")}</strong>
              </label>
            </div>
            {milestoneEditor("station")}
          </div>
        )}

        {stationMode === "preview" && (
          <div className="escrow-station__panel escrow-station__panel--preview">
            <div className="escrow-route-meter escrow-route-meter--preview" aria-label={t("releaseRouteTitle")}>
              {releaseSteps.map((step, index) => (
                <div className="escrow-route-meter__step" data-complete={step.complete ? "true" : undefined} key={step.key}>
                  <span className="escrow-route-meter__icon">{step.icon}</span>
                  <span className="escrow-route-meter__copy">
                    <small>{step.label}</small>
                    <strong>{step.value}</strong>
                  </span>
                  {index < releaseSteps.length - 1 && <span className="escrow-route-meter__line" aria-hidden="true" />}
                </div>
              ))}
            </div>
            <div className="escrow-preview-ticket">
              <span><WalletCards size={15} aria-hidden="true" /> {t("totalAmount")}</span>
              <strong>{totalDisplay}</strong>
              <p>{t("previewTicketCopy", { count: milestoneAmounts.length, asset })}</p>
            </div>
            <ol className="escrow-preview-list">
              {milestoneAmounts.map((amount, index) => (
                <li key={index} data-filled={parseAmount(amount) > 0n ? "true" : undefined}>
                  <span>{t("milestoneNumber", { n: index + 1 })}</span>
                  <strong>{amount ? `${amount} ${asset}` : t("draftGate")}</strong>
                </li>
              ))}
            </ol>
          </div>
        )}

        {stationMode === "safety" && (
          <div className="escrow-station__panel escrow-station__panel--safety">
            <OpenUiNotice className="escrow-station-notice" icon={<BadgeCheck size={17} aria-hidden="true" />} title={t("noFeeNotice")}>
              {t("twoStepSignNotice", { asset })}
            </OpenUiNotice>
            <div className="escrow-safety-grid">
              <span><ShieldCheck size={16} aria-hidden="true" />{t("beneficiaryApprovalNote")}</span>
              <span><LockKeyhole size={16} aria-hidden="true" />{t("depositPrepaidNoEscrow")}</span>
              <span><ListChecks size={16} aria-hidden="true" />{contractReady ? primaryHint : t("deploymentPendingDesc")}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );

  const renderLedgerItem = (esc: EscrowItem, role: "creator" | "beneficiary") => {
    const sym = String(esc.assetSymbol ?? "GAS");
    const total = formatBaseUnits(asBaseUnits(esc.totalAmount), sym);
    const approved = esc.milestoneApproved ?? [];
    const claimed = esc.milestoneClaimed ?? [];
    const allClaimed = claimed.length > 0 && claimed.every(Boolean);
    const hasApproved = approved.some((a, i) => a && !claimed[i]);
    const isApproving = approvingId === esc.id || approvingId.startsWith(`${esc.id}-`);
    const isClaiming = claimingId === esc.id || claimingId.startsWith(`${esc.id}-`);
    const milestoneCount = Array.isArray(esc.milestoneAmounts) ? esc.milestoneAmounts.length : Math.max(approved.length, claimed.length);
    const approvedCount = approved.filter(Boolean).length;
    const claimedCount = claimed.filter(Boolean).length;
    const counterparty = role === "creator" ? formatAddress(String(esc.beneficiary ?? "")) : formatAddress(String(esc.creator ?? ""));
    return (
      <li key={`${role}-${esc.id}`} className="escrow-ledger__item" data-role={role}>
        <div className="escrow-ledger__topline">
          <span className="escrow-ledger__role">{role === "creator" ? t("createdByYou") : t("forYou")}</span>
          <span className="escrow-ledger__status">{statusLabel(String(esc.status ?? "active"))}</span>
        </div>
        <div className="escrow-ledger__body">
          <span className="escrow-ledger__coin">
            <CoinArt size={28} variant={sym === "NEO" ? "neo" : "gas"} decorative />
          </span>
          <div className="escrow-ledger__copy">
            <span className="escrow-ledger__name">{String(esc.title ?? `${t("idPrefix")}${esc.id}`)}</span>
            <span className="escrow-ledger__meta">{counterparty || t("recipientPending")}</span>
          </div>
          <span className="escrow-ledger__amount">{total}</span>
        </div>
        <dl className="escrow-ledger__progress">
          <div>
            <dt>{t("milestonesLabel")}</dt>
            <dd>{milestoneCount || "-"}</dd>
          </div>
          <div>
            <dt>{t("approve")}</dt>
            <dd>{approvedCount}</dd>
          </div>
          <div>
            <dt>{t("claim")}</dt>
            <dd>{claimedCount}</dd>
          </div>
        </dl>
        <div className="escrow-ledger__actions">
          {role === "creator" && !allClaimed && (
            <>
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("approveMilestone", esc)} disabled={isApproving}>{isApproving ? t("approving") : t("approve")}</button>
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => {
                  if (window.confirm(t("confirmCancelRefund", { amount: total }))) void dispatch("cancelEscrow", esc);
                }}
                disabled={cancellingId === esc.id}
              >
                {cancellingId === esc.id ? t("cancelling") : t("cancel")}
              </button>
            </>
          )}
          {role === "beneficiary" && hasApproved && !allClaimed && (
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("claimMilestone", esc)} disabled={isClaiming}>{isClaiming ? t("claiming") : t("claim")}</button>
          )}
        </div>
      </li>
    );
  };

  const drawerPanel = (() => {
    if (drawerMode === "created") {
      return (
        <OpenUiPanel
          className="escrow-drawer__panel"
          icon={<LockKeyhole size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("createdByYou")}
          subtitle={String(creatorEscrows.length)}
        >
          {creatorEscrows.length > 0 ? (
            <ul className="escrow-ledger">{creatorEscrows.slice(0, 10).map((esc) => renderLedgerItem(esc, "creator"))}</ul>
          ) : (
            <OpenUiNotice className="escrow-drawer__empty" icon={<LockKeyhole size={18} strokeWidth={2.35} aria-hidden="true" />} title={t("emptyEscrows")}>
              {t("createdByYou")}
            </OpenUiNotice>
          )}
        </OpenUiPanel>
      );
    }
    if (drawerMode === "beneficiary") {
      return (
        <OpenUiPanel
          className="escrow-drawer__panel"
          icon={<UserRound size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("forYou")}
          subtitle={String(beneficiaryEscrows.length)}
        >
          {beneficiaryEscrows.length > 0 ? (
            <ul className="escrow-ledger">{beneficiaryEscrows.slice(0, 10).map((esc) => renderLedgerItem(esc, "beneficiary"))}</ul>
          ) : (
            <OpenUiNotice className="escrow-drawer__empty" icon={<UserRound size={18} strokeWidth={2.35} aria-hidden="true" />} title={t("emptyEscrows")}>
              {t("forYou")}
            </OpenUiNotice>
          )}
          <OpenUiNotice className="escrow-drawer__notice" icon={<BadgeCheck size={18} strokeWidth={2.35} aria-hidden="true" />} title={t("beneficiaryApprovalNote")} />
        </OpenUiPanel>
      );
    }
    return (
      <OpenUiPanel
        className="escrow-drawer__panel escrow-drawer__panel--details"
        icon={<BadgeCheck size={18} strokeWidth={2.35} aria-hidden="true" />}
        title={t("setupPlan")}
        subtitle={t("twoStepSignNotice", { asset })}
      >
        <div className="escrow-drawer__form-grid escrow-drawer__form-grid--setup">
          <OpenUiSegmented
            className="escrow-detail-field escrow-detail-field--asset"
            label={t("assetType")}
            value={asset}
            onChange={(value) => selectAsset(value as "GAS" | "NEO")}
            options={[
              { value: "GAS", label: "GAS" },
              { value: "NEO", label: "NEO" },
            ]}
            disabled={isCreating}
            hint={asset === "NEO" ? t("assetNeoHint") : t("assetGasHint")}
          />
          <OpenUiTextField
            className="escrow-detail-field escrow-detail-field--wide"
            label={t("beneficiary")}
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            placeholder={t("beneficiaryPlaceholder")}
            disabled={isCreating || !contractReady}
            spellCheck={false}
            mono
          />
          <OpenUiTextField
            className="escrow-detail-field"
            label={t("escrowName")}
            value={escrowName}
            onChange={(e) => setEscrowName(e.target.value)}
            placeholder={t("escrowNamePlaceholder")}
            disabled={isCreating}
          />
          <OpenUiTextArea
            className="escrow-detail-field mx2-open-field--compact"
            label={t("notes")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("notesPlaceholder")}
            disabled={isCreating}
            rows={3}
          />
        </div>
        {milestoneEditor("drawer")}
        <OpenUiNotice
          className="escrow-drawer__notice"
          icon={<Route size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("releaseRouteTitle")}
        >
          {contractReady ? t("twoStepSignNotice", { asset }) : t("deploymentPendingDesc")}
        </OpenUiNotice>
      </OpenUiPanel>
    );
  })();

  const drawer = (
    <div className="escrow-drawer">
      <div className="escrow-drawer-tabs" role="tablist" aria-label={t("escrowsTab")}>
        {drawerModes.map((item) => (
          <button
            key={item.mode}
            type="button"
            role="tab"
            aria-selected={drawerMode === item.mode}
            className={drawerMode === item.mode ? "is-active" : undefined}
            onClick={() => setDrawerMode(item.mode)}
          >
            {item.icon}
            <span>{item.label}</span>
            <em>{item.meta}</em>
          </button>
        ))}
      </div>
      <div className="escrow-drawer__active" data-mode={drawerMode}>
        {drawerPanel}
      </div>
    </div>
  );

  const allEscrows = [...creatorEscrows, ...beneficiaryEscrows];
  const totalEscrows = allEscrows.length;

  return (
    <OpenUiProvider>
      <div className="milestone-escrow-play-area mx2 mx2-cat-defi">
        <PlayStage
          category="defi"
          stage={{
            eyebrow: t("title"),
            title: t("releaseDeskTitle"),
            subtitle: hasAddress ? t("releaseDeskCopy") : t("introLede"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {activeCount} {t("statusActive").toLowerCase()}</span>,
          }}
          scene={scene}
          score={[
            { label: t("totalAmount"), value: totalAmount > 0n ? formatBaseUnits(totalAmount, asset) : "-", accent: true },
            { label: t("statusActive"), value: String(activeCount) },
            { label: t("statusCompleted"), value: String(completedCount) },
            { label: t("escrowsTab"), value: String(totalEscrows) },
          ]}
          actions={{
            primary: {
              label: primaryLabel,
              onClick: () => void handlePrimary(),
              disabled: hasAddress ? !canSubmit : false,
              loading: isCreating,
              hint: primaryHint,
              icon: <BadgeCheck size={17} aria-hidden="true" />,
            },
            secondary: hasAddress
              ? [
                {
                  label: t("setupPlan"),
                  icon: <SlidersHorizontal size={15} aria-hidden="true" />,
                  onClick: () => setStationMode("setup"),
                  disabled: isCreating,
                },
              ]
              : undefined,
          }}
          drawerToggleLabel={t("setupAndEscrows")}
          drawer={{
            title: t("setupAndEscrows"),
            children: drawer,
          }}
        />
      </div>
    </OpenUiProvider>
  );
}
