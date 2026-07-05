/**
 * PlayArea.tsx -- AA Permissions Lab (v2 scene-driven rebuild)
 *
 * Tool identity. The permission boundary IS the scene: the live verifier + hook
 * + backup owner bindings for the inspected account, with pending two-phase
 * rotations shown as a propose → timelock → confirm/cancel route. Refresh
 * (inspect) is the primary read; the propose/confirm/cancel controls live in a
 * drawer so the stage shows the current boundary, not a form. Real state from
 * useAAPermissionsLab is bound throughout.
 */
import { useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import { AlertTriangle, CircleCheckBig, KeyRound, LoaderCircle, PlugZap, ShieldCheck, Timer, WalletCards } from "lucide-react";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

function compactHash(value: string): string {
  const v = String(value || "").trim();
  if (!v || v === "—") return "—";
  if (v.length <= 14) return v;
  return `${v.slice(0, 8)}…${v.slice(-6)}`;
}

const PERMISSION_CONSOLE_ART = "permission-console.webp";

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool } = useStateBindings(state);

  const currentVerifier = str("currentVerifier");
  const currentHook = str("currentHook");
  const currentBackupOwner = str("currentBackupOwner");
  const hasInspected = bool("hasInspected");
  const hasPendingVerifier = bool("hasPendingVerifier");
  const hasPendingHook = bool("hasPendingHook");
  const pendingVerifierUnlockAt = str("pendingVerifierUnlockAt");
  const pendingHookUnlockAt = str("pendingHookUnlockAt");
  const connectedWallet = str("connectedWalletDisplay");
  const isRefreshing = bool("isRefreshing");
  const isVerifierBusy = bool("isVerifierBusy");
  const isHookBusy = bool("isHookBusy");

  const [draftAccount, setDraftAccount] = useState("");
  const [draftVerifier, setDraftVerifier] = useState("");
  const [draftHook, setDraftHook] = useState("");

  const busy = isRefreshing || isVerifierBusy || isHookBusy;
  const handleRefresh = () => { void dispatch("refresh", draftAccount); };
  const handleConnect = () => { void dispatch("connect"); };
  const handleProposeVerifier = () => { void dispatch("submitVerifier", draftAccount, draftVerifier, ""); };
  const handleProposeHook = () => { void dispatch("submitHook", draftAccount, draftHook); };
  const handleConfirmVerifier = () => { void dispatch("confirmVerifier", draftAccount); };
  const handleCancelVerifier = () => { void dispatch("cancelVerifier", draftAccount); };
  const handleConfirmHook = () => { void dispatch("confirmHook", draftAccount); };
  const handleCancelHook = () => { void dispatch("cancelHook", draftAccount); };

  const accountReady = draftAccount.trim().length > 0;
  const routeState = busy
    ? isRefreshing
      ? t("permissionsRouteStatusInspect")
      : isVerifierBusy
        ? t("permissionsRouteStatusVerifier")
        : t("permissionsRouteStatusHook")
    : hasPendingVerifier
      ? t("permissionsRouteStatusPendingVerifier")
      : hasPendingHook
        ? t("permissionsRouteStatusPendingHook")
        : hasInspected
          ? t("permissionsRouteStatusReady")
          : accountReady
            ? t("permissionsRouteStatusArmed")
            : t("permissionsRouteStatusEmpty");
  const liveStateTitle = hasInspected ? t("permissionsStateTitle") : t("permissionsStateEmpty");
  const timelockValue = hasPendingVerifier
    ? pendingVerifierUnlockAt || t("permissionsRoutePending")
    : hasPendingHook
      ? pendingHookUnlockAt || t("permissionsRoutePending")
      : hasInspected
        ? t("permissionsRouteGuard")
        : "—";
  const verifierValue = hasInspected ? compactHash(currentVerifier) : t("notInspected");
  const hookValue = hasInspected ? compactHash(currentHook) : t("notInspected");
  const accountValue = accountReady ? compactHash(draftAccount) : t("permissionsRouteAccountEmpty");
  const routeNodes = [
    {
      key: "account",
      label: t("permissionsRouteAccount"),
      value: accountValue,
      active: accountReady || hasInspected,
      icon: ShieldCheck,
    },
    {
      key: "verifier",
      label: t("permissionsRouteVerifier"),
      value: verifierValue,
      active: hasInspected || hasPendingVerifier,
      pending: hasPendingVerifier,
      icon: KeyRound,
    },
    {
      key: "timelock",
      label: t("permissionsRouteTimelock"),
      value: timelockValue,
      active: hasPendingVerifier || hasPendingHook,
      pending: hasPendingVerifier || hasPendingHook,
      icon: Timer,
    },
    {
      key: "hook",
      label: t("permissionsRouteHook"),
      value: hookValue,
      active: hasInspected || hasPendingHook,
      pending: hasPendingHook,
      icon: PlugZap,
    },
  ];

  const scene = (
    <div className="perms-scene" data-state={busy ? "busy" : hasInspected ? "inspected" : "idle"}>
      <div className="perms-boundary">
        <div className="perms-boundary__target-bar">
          <div className="perms-boundary__target-copy">
            <WalletCards size={18} aria-hidden="true" />
            <div>
              <span>{t("permissionsCommandTitle")}</span>
              <strong>{accountReady ? compactHash(draftAccount) : t("permissionsRouteStatusEmpty")}</strong>
            </div>
          </div>
          <OpenUiTextField
            className="perms-boundary__target-input"
            label={t("accountId")}
            value={draftAccount}
            onChange={(e) => setDraftAccount(e.target.value)}
            placeholder={t("accountIdHashPlaceholder")}
            mono
            spellCheck={false}
          />
        </div>

        <div className="perms-boundary__map" aria-label={t("permissionsFlowLabel")}>
          <div className="perms-boundary__visual" aria-hidden="true">
            <img src={PERMISSION_CONSOLE_ART} alt="" loading="eager" decoding="async" />
            <span>{t("permissionsHeroVisualLabel")}</span>
          </div>

          <div className="perms-boundary__core">
            <span className="perms-boundary__core-orb" aria-hidden="true">
              {busy ? <LoaderCircle size={28} /> : <ShieldCheck size={30} />}
            </span>
            <span>{t("permissionsRouteStageLabel")}</span>
            <strong>{liveStateTitle}</strong>
            <p>{routeState}</p>
          </div>

          <div className="perms-boundary__route">
            {routeNodes.map(({ key, label, value, active, pending, icon: Icon }) => (
              <div
                className="perms-boundary__gate"
                key={key}
                data-kind={key}
                data-active={active ? "true" : undefined}
                data-pending={pending ? "true" : undefined}
              >
                <span className="perms-boundary__gate-icon" aria-hidden="true">
                  <Icon size={19} />
                </span>
                <span className="perms-boundary__gate-copy">
                  <span className="perms-boundary__gate-label">{label}</span>
                  <strong className="perms-boundary__gate-value">{value}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="perms-boundary__guard">
          <span>
            <CircleCheckBig size={16} aria-hidden="true" />
            {routeState}
          </span>
          <small>
            <AlertTriangle size={14} aria-hidden="true" />
            {t("permissionsRiskCopy")}
          </small>
        </div>
      </div>
    </div>
  );

  const readout = hasInspected ? [
    { label: t("currentVerifier"), value: compactHash(currentVerifier), accent: hasPendingVerifier },
    { label: t("currentHook"), value: compactHash(currentHook), accent: hasPendingHook },
    { label: t("currentBackupOwner"), value: compactHash(currentBackupOwner) },
  ] : [
    { label: t("connectedWallet"), value: connectedWallet ? compactHash(connectedWallet) : t("notConnected") },
    { label: t("permissionsMetricAccount"), value: draftAccount ? compactHash(draftAccount) : "—" },
    { label: t("permissionsHeroEyebrow"), value: hasInspected ? t("configured") : t("notInspected") },
  ];

  const drawer = (
    <div className="perms-drawer">
      <OpenUiPanel
        className="perms-drawer__panel perms-drawer__panel--wide"
        icon={<WalletCards size={16} />}
        title={t("permissionsCommandTitle")}
        subtitle={accountReady ? compactHash(draftAccount) : t("permissionsRouteStatusEmpty")}
        titleId="perms-drawer-account"
      >
        <OpenUiTextField
          className="perms-drawer__field"
          label={t("accountId")}
          value={draftAccount}
          onChange={(e) => setDraftAccount(e.target.value)}
          placeholder={t("accountIdHashPlaceholder")}
          mono
        />
        {!connectedWallet && (
          <button type="button" className="perms-drawer__connect mx2-btn mx2-btn--ghost" onClick={handleConnect}>
            <WalletCards size={15} /> {t("connectWallet")}
          </button>
        )}
      </OpenUiPanel>

      <OpenUiNotice
        className="perms-drawer__notice"
        icon={<Timer size={16} />}
        title={t("twoPhaseExplainer")}
      />

      <OpenUiPanel
        className="perms-drawer__panel"
        icon={<KeyRound size={16} />}
        title={t("updateVerifier")}
        subtitle={hasPendingVerifier && pendingVerifierUnlockAt ? pendingVerifierUnlockAt : t("permissionsRouteGuard")}
        titleId="perms-drawer-verifier"
      >
        <OpenUiTextField
          className="perms-drawer__field"
          label={t("updateVerifier")}
          value={draftVerifier}
          onChange={(e) => setDraftVerifier(e.target.value)}
          placeholder={t("verifierHashPlaceholder")}
          mono
        />
        <div className="perms-drawer__row">
          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleProposeVerifier} disabled={!draftAccount || !draftVerifier}>{t("writeStagePropose")}</button>
          {hasPendingVerifier && (<>
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleConfirmVerifier}>{t("confirmUpdate")}</button>
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleCancelVerifier}>{t("cancelUpdate")}</button>
          </>)}
        </div>
        {hasPendingVerifier && pendingVerifierUnlockAt && <small>{pendingVerifierUnlockAt}</small>}
      </OpenUiPanel>

      <OpenUiPanel
        className="perms-drawer__panel"
        icon={<PlugZap size={16} />}
        title={t("updateHook")}
        subtitle={hasPendingHook && pendingHookUnlockAt ? pendingHookUnlockAt : t("permissionsRouteGuard")}
        titleId="perms-drawer-hook"
      >
        <OpenUiTextField
          className="perms-drawer__field"
          label={t("updateHook")}
          value={draftHook}
          onChange={(e) => setDraftHook(e.target.value)}
          placeholder={t("hookHashPlaceholder")}
          mono
        />
        <div className="perms-drawer__row">
          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleProposeHook} disabled={!draftAccount || !draftHook}>{t("writeStagePropose")}</button>
          {hasPendingHook && (<>
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleConfirmHook}>{t("confirmUpdate")}</button>
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleCancelHook}>{t("cancelUpdate")}</button>
          </>)}
        </div>
        {hasPendingHook && pendingHookUnlockAt && <small>{pendingHookUnlockAt}</small>}
      </OpenUiPanel>
    </div>
  );

  return (
    <div className="perms-play-area mx2 mx2-cat-tool">
      <OpenUiProvider>
        <PlayStage
          category="tool"
          stage={{ eyebrow: t("permissionsHeroEyebrow"), title: t("permissionsHeroTitle"), subtitle: t("permissionsHeroChip") }}
          scene={scene}
          score={readout}
          actions={{
            primary: { label: t("inspect"), onClick: handleRefresh, loading: busy, disabled: !accountReady },
            secondary: connectedWallet ? undefined : [{ label: t("connectWallet"), onClick: handleConnect }],
          }}
          drawerToggleLabel={t("permissionsCommandTitle")}
          drawer={{ title: t("permissionsCommandTitle"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
