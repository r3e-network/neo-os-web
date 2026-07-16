import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  KeyRound,
  LockKeyhole,
  Network,
  PlugZap,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import type { ObservableState } from "@shared/react/context";
import { useNowMs } from "@shared/react/hooks/useNowMs";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import type { ActionRailAction } from "@shared/components-react/v2/ActionRail";
import type { getPermissionsLaunchDefaults } from "./launch";
import {
  ZERO_HASH,
  formatPermissionUnlock,
  isPermissionUnlockReady,
  normalizePermissionHash,
  shortPermissionHash,
  type PendingPermissionTransaction,
  type PermissionLane,
  type PermissionProposalContext,
} from "./permissions";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type PermissionLaunchForm = ReturnType<typeof getPermissionsLaunchDefaults>;

const EMPTY_LAUNCH_FORM: PermissionLaunchForm = {
  accountIdHash: "",
  verifierHash: "",
  verifierParamsHex: "",
  hookHash: "",
};

const PERMISSION_CONSOLE_ART = new URL(
  "../public/permission-console.webp",
  import.meta.url,
).href;

function sameHash(left: string, right: string) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function remainingLabel(
  unlockAt: number,
  now: number,
  t: PlayAreaProps["t"],
) {
  const remaining = Math.max(0, unlockAt - now);
  if (remaining <= 0) return t("timelockReady");
  const totalMinutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return t("timelockRemainingHours", { hours, minutes });
  return t("timelockRemainingMinutes", { minutes });
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const network = str("network", "mainnet");
  const aaCore = str("aaCore");
  const launchForm = val<PermissionLaunchForm>("launchForm", EMPTY_LAUNCH_FORM) ?? EMPTY_LAUNCH_FORM;
  const currentVerifier = str("currentVerifier");
  const currentHook = str("currentHook");
  const currentBackupOwner = str("currentBackupOwner");
  const inspectedAccountId = str("inspectedAccountId");
  const connectedWallet = str("connectedWalletDisplay");
  const walletNetwork = str("walletNetwork");
  const walletNetworkMatches = bool("walletNetworkMatches");
  const hasInspected = bool("hasInspected");
  const hasPendingVerifier = bool("hasPendingVerifier");
  const hasPendingHook = bool("hasPendingHook");
  const pendingVerifierUnlockAt = num("pendingVerifierUnlockAt");
  const pendingHookUnlockAt = num("pendingHookUnlockAt");
  const proposalVerifier = val<PermissionProposalContext>("proposalVerifier");
  const proposalHook = val<PermissionProposalContext>("proposalHook");
  const pendingTransaction = val<PendingPermissionTransaction>("pendingTransaction");
  const pendingTxid = str("pendingTxid");
  const readError = str("readError");
  const lastWriteStatus = str("lastWriteStatus");
  const storageHealthy = bool("storageHealthy");
  const isRefreshing = bool("isRefreshing");
  const isVerifierBusy = bool("isVerifierBusy");
  const isHookBusy = bool("isHookBusy");
  const isRecovering = bool("isRecovering");
  const isCheckingWallet = bool("isCheckingWallet");

  const [accountId, setAccountId] = useState(launchForm.accountIdHash);
  const [lane, setLane] = useState<PermissionLane>(
    launchForm.hookHash && !launchForm.verifierHash ? "hook" : "verifier",
  );
  const [verifierTarget, setVerifierTarget] = useState(launchForm.verifierHash);
  const [verifierParams, setVerifierParams] = useState(launchForm.verifierParamsHex);
  const [hookTarget, setHookTarget] = useState(launchForm.hookHash);
  const restoredTxRef = useRef("");

  useEffect(() => {
    if (!pendingTransaction || restoredTxRef.current === pendingTransaction.txid) return;
    restoredTxRef.current = pendingTransaction.txid;
    setAccountId(pendingTransaction.accountId);
    setLane(pendingTransaction.lane);
    if (pendingTransaction.targetHash) {
      if (pendingTransaction.lane === "verifier") setVerifierTarget(pendingTransaction.targetHash);
      else setHookTarget(pendingTransaction.targetHash);
    }
  }, [pendingTransaction]);

  useEffect(() => {
    if (pendingTransaction) return;
    if (hasPendingVerifier && !hasPendingHook) setLane("verifier");
    if (hasPendingHook && !hasPendingVerifier) setLane("hook");
  }, [hasPendingHook, hasPendingVerifier, pendingTransaction]);

  useEffect(() => {
    const proposal = lane === "verifier" ? proposalVerifier : proposalHook;
    if (!proposal?.targetHash) return;
    if (lane === "verifier") setVerifierTarget(proposal.targetHash);
    else setHookTarget(proposal.targetHash);
  }, [lane, proposalHook, proposalVerifier]);

  const normalizedAccount = normalizePermissionHash(accountId, false) ?? "";
  const bindingCurrent = Boolean(
    hasInspected && normalizedAccount && sameHash(normalizedAccount, inspectedAccountId),
  );

  useEffect(() => {
    if (!hasInspected || sameHash(normalizedAccount, inspectedAccountId)) return;
    void dispatch("invalidateBinding");
  }, [dispatch, hasInspected, inspectedAccountId, normalizedAccount]);

  const selectedPending = lane === "verifier" ? hasPendingVerifier : hasPendingHook;
  const selectedUnlockAt = lane === "verifier"
    ? pendingVerifierUnlockAt
    : pendingHookUnlockAt;

  const now = useNowMs(30_000, {
    enabled: selectedPending && selectedUnlockAt > 0,
    resetKey: selectedUnlockAt,
  });

  const currentBinding = bindingCurrent
    ? lane === "verifier" ? currentVerifier : currentHook
    : "";
  const selectedProposal = lane === "verifier" ? proposalVerifier : proposalHook;
  const targetDraft = lane === "verifier" ? verifierTarget : hookTarget;
  const normalizedTarget = normalizePermissionHash(targetDraft) ?? "";
  const currentComparable = currentBinding || ZERO_HASH;
  const targetChanged = Boolean(normalizedTarget && !sameHash(normalizedTarget, currentComparable));
  const unlockReady = selectedPending && isPermissionUnlockReady(selectedUnlockAt, now);
  const busy = isRefreshing || isVerifierBusy || isHookBusy || isRecovering || isCheckingWallet;
  const ownerConnected = Boolean(connectedWallet && sameHash(connectedWallet, currentBackupOwner));
  const wrongOwnerConnected = Boolean(connectedWallet && bindingCurrent && !ownerConnected);
  const networkMismatch = Boolean(walletNetwork && !walletNetworkMatches);
  const proposalTarget = selectedProposal?.targetHash ||
    (pendingTransaction?.lane === lane ? pendingTransaction.targetHash : "");
  const locale = globalThis.document?.documentElement.lang || globalThis.navigator?.language || "en";
  const unlockDate = selectedPending
    ? formatPermissionUnlock(selectedUnlockAt, locale)
    : "";

  const submitSelected = () => {
    if (lane === "verifier") {
      void dispatch("submitVerifier", accountId, verifierTarget, verifierParams);
    } else {
      void dispatch("submitHook", accountId, hookTarget);
    }
  };
  const confirmSelected = () => {
    void dispatch(lane === "verifier" ? "confirmVerifier" : "confirmHook", accountId);
  };
  const cancelSelected = () => {
    void dispatch(lane === "verifier" ? "cancelVerifier" : "cancelHook", accountId);
  };

  let primary: ActionRailAction;
  if (pendingTransaction) {
    primary = {
      label: t("checkTransaction"),
      onClick: () => { void dispatch("reconcileTransaction"); },
      icon: <RefreshCw size={17} aria-hidden="true" />,
      loading: isRecovering,
      disabled: busy && !isRecovering,
      hint: t("checkTransactionHint"),
    };
  } else if (!bindingCurrent) {
    primary = {
      label: t("inspectAccount"),
      onClick: () => { void dispatch("inspectBinding", accountId); },
      icon: <Search size={17} aria-hidden="true" />,
      loading: isRefreshing,
      disabled: !normalizedAccount || busy,
      hint: normalizedAccount ? t("inspectAccountHint") : t("validAccountRequired"),
    };
  } else if (!connectedWallet) {
    primary = {
      label: t("connectBackupOwner"),
      onClick: () => { void dispatch("connect"); },
      icon: <WalletCards size={17} aria-hidden="true" />,
      disabled: busy,
      hint: t("connectBackupOwnerHint"),
    };
  } else if (wrongOwnerConnected) {
    primary = {
      label: t("useBackupOwnerWallet"),
      onClick: () => {},
      icon: <WalletCards size={17} aria-hidden="true" />,
      disabled: true,
      hint: t("wrongBackupOwnerHint"),
    };
  } else if (!storageHealthy) {
    primary = {
      label: t("writesLockedNoRecovery"),
      onClick: () => {},
      icon: <LockKeyhole size={17} aria-hidden="true" />,
      disabled: true,
      hint: t("recoveryStorageUnavailable"),
    };
  } else if (networkMismatch) {
    primary = {
      label: t("recheckWalletNetwork"),
      onClick: () => { void dispatch("checkWalletAuthority", accountId); },
      icon: <Network size={17} aria-hidden="true" />,
      loading: isCheckingWallet,
      disabled: busy && !isCheckingWallet,
      hint: t("walletNetworkMismatch", { network }),
    };
  } else if (selectedPending) {
    primary = {
      label: unlockReady ? t("confirmRotation") : t("safetyWindowActive"),
      onClick: confirmSelected,
      icon: unlockReady
        ? <CheckCircle2 size={17} aria-hidden="true" />
        : <Clock3 size={17} aria-hidden="true" />,
      loading: lane === "verifier" ? isVerifierBusy : isHookBusy,
      disabled: !unlockReady || busy,
      hint: unlockReady
        ? t("confirmRotationHint")
        : t("pendingUnlockAt", { time: unlockDate }),
    };
  } else {
    const firstInstall = !currentBinding;
    primary = {
      label: firstInstall ? t("installBindingNow") : t("proposeRotation"),
      onClick: submitSelected,
      icon: firstInstall
        ? <PlugZap size={17} aria-hidden="true" />
        : <LockKeyhole size={17} aria-hidden="true" />,
      loading: lane === "verifier" ? isVerifierBusy : isHookBusy,
      disabled: !targetChanged || busy,
      hint: !normalizedTarget
        ? t("targetRequiredHint")
        : !targetChanged
          ? t("targetUnchangedHint")
          : firstInstall
            ? t("firstInstallHint")
            : t("proposeRotationHint"),
    };
  }

  const secondary: ActionRailAction[] = [];
  if (selectedPending && !pendingTransaction && ownerConnected) {
    secondary.push({
      label: t("cancelProposal"),
      onClick: cancelSelected,
      icon: <XCircle size={16} aria-hidden="true" />,
      disabled: busy,
      hint: t("cancelProposalHint"),
    });
  }

  const timeline = useMemo(() => [
    {
      key: "proposal",
      label: t("lifecyclePropose"),
      copy: selectedPending ? t("lifecycleProposalRecorded") : t("lifecycleProposalIdle"),
      icon: KeyRound,
      state: selectedPending ? "done" : bindingCurrent && targetChanged ? "active" : "idle",
    },
    {
      key: "window",
      label: t("lifecycleWindow"),
      copy: selectedPending
        ? remainingLabel(selectedUnlockAt, now, t)
        : t("lifecycleWindowIdle"),
      icon: Clock3,
      state: selectedPending ? unlockReady ? "done" : "active" : "idle",
    },
    {
      key: "confirm",
      label: t("lifecycleConfirm"),
      copy: unlockReady ? t("lifecycleConfirmReady") : t("lifecycleConfirmIdle"),
      icon: CheckCircle2,
      state: unlockReady ? "active" : "idle",
    },
  ], [bindingCurrent, now, selectedPending, selectedUnlockAt, t, targetChanged, unlockReady]);

  const statusTone = readError
    ? "error"
    : !storageHealthy || networkMismatch || wrongOwnerConnected
      ? "warning"
      : "info";
  const statusTitle = readError ||
    (pendingTransaction
      ? t("transactionRecoveryTitle")
      : !storageHealthy
        ? t("recoveryStorageUnavailable")
        : networkMismatch
          ? t("walletNetworkMismatch", { network })
          : wrongOwnerConnected
            ? t("wrongBackupOwner")
            : selectedPending
              ? unlockReady
                ? t("rotationReadyTitle")
                : t("rotationWaitingTitle")
              : bindingCurrent
                ? currentBinding
                  ? t("bindingLiveTitle")
                  : t("bindingEmptyTitle")
                : normalizedAccount
                  ? t("inspectionNeededTitle")
                  : t("chooseAccountTitle"));

  const selectedLaneLabel = lane === "verifier" ? t("verifierLane") : t("hookLane");
  const currentBindingLabel = currentBinding
    ? shortPermissionHash(currentBinding)
    : bindingCurrent ? t("notInstalled") : t("notInspected");
  const ownerLabel = bindingCurrent
    ? ownerConnected
      ? t("ownerConnected")
      : wrongOwnerConnected
        ? t("wrongWallet")
        : t("ownerNotConnected")
    : t("notInspected");
  const lifecycleLabel = pendingTransaction
    ? t("transactionInFlight")
    : selectedPending
      ? unlockReady ? t("readyToConfirm") : t("waitingForTimelock")
      : currentBinding ? t("noPendingRotation") : t("notInspected");

  const scene = (
    <div
      className="perms-workspace"
      data-state={pendingTransaction ? "recovering" : selectedPending ? "pending" : bindingCurrent ? "bound" : "idle"}
      aria-busy={busy || undefined}
    >
      <section className="perms-console" aria-label={t("permissionConsoleLabel")}>
        <img
          className="perms-console__art"
          src={PERMISSION_CONSOLE_ART}
          alt={t("permissionConsoleAlt")}
          loading="eager"
          decoding="async"
        />
        <div className="perms-console__veil" aria-hidden="true" />
        <div className="perms-console__network">
          <Network size={15} aria-hidden="true" />
          <span>{network === "mainnet" ? t("neoMainnet") : t("neoTestnet")}</span>
        </div>

        <article className="perms-passport">
          <header className="perms-passport__head">
            <span className="perms-passport__mark" aria-hidden="true">
              <ShieldCheck size={23} />
            </span>
            <div>
              <span>{t("accountPermissionBinding")}</span>
              <strong>{bindingCurrent ? t("liveChainRecord") : t("inspectionRequired")}</strong>
            </div>
            <span className="perms-passport__lane" data-lane={lane}>{selectedLaneLabel}</span>
          </header>

          <div className="perms-passport__identity">
            <span>{t("accountId")}</span>
            <strong>{normalizedAccount ? shortPermissionHash(normalizedAccount, 12, 8) : t("noAccountSelected")}</strong>
          </div>

          <div className="perms-passport__bindings">
            <div>
              {lane === "verifier" ? <KeyRound size={17} aria-hidden="true" /> : <PlugZap size={17} aria-hidden="true" />}
              <span><small>{t("currentBinding")}</small><strong>{currentBindingLabel}</strong></span>
            </div>
            <div>
              <WalletCards size={17} aria-hidden="true" />
              <span><small>{t("backupOwner")}</small><strong>{ownerLabel}</strong></span>
            </div>
          </div>

          <footer className="perms-passport__foot">
            <span data-live={bindingCurrent ? "true" : undefined}>
              {bindingCurrent ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}
              {bindingCurrent ? t("boundToNetwork", { network }) : t("notBoundToDraft")}
            </span>
            <small>{aaCore ? shortPermissionHash(aaCore) : "—"}</small>
          </footer>
        </article>
      </section>

      <section className="perms-lifecycle" aria-label={t("rotationLifecycleLabel")}>
        <header>
          <div>
            <strong>{t("rotationLifecycleTitle", { lane: selectedLaneLabel })}</strong>
            <span>{currentBinding ? t("replacementUsesTimelock") : t("firstInstallIsImmediate")}</span>
          </div>
          {proposalTarget ? (
            <span className="perms-lifecycle__target">
              <ArrowRight size={14} aria-hidden="true" />
              {shortPermissionHash(proposalTarget)}
            </span>
          ) : null}
        </header>
        <div className="perms-lifecycle__track">
          {timeline.map(({ key, label, copy, icon: Icon, state: stepState }, index) => (
            <div className="perms-lifecycle__step" data-step={stepState} key={key}>
              <span className="perms-lifecycle__icon"><Icon size={18} aria-hidden="true" /></span>
              <span><strong>{label}</strong><small>{copy}</small></span>
              {index < timeline.length - 1 ? <i aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      </section>

      <OpenUiNotice
        className="perms-status"
        type={statusTone}
        icon={statusTone === "error" ? <CircleAlert size={17} /> : statusTone === "warning" ? <LockKeyhole size={17} /> : <ShieldCheck size={17} />}
        title={statusTitle}
      >
        {pendingTransaction
          ? t("transactionRecoveryCopy", { txid: shortPermissionHash(pendingTxid, 10, 8) })
          : selectedPending && unlockDate
            ? t("pendingUnlockAt", { time: unlockDate })
            : lastWriteStatus}
      </OpenUiNotice>
    </div>
  );

  const readout = [
    { label: t("selectedLane"), value: selectedLaneLabel, accent: true },
    { label: t("bindingState"), value: currentBindingLabel },
    { label: t("rotationState"), value: lifecycleLabel },
  ];

  const drawer = (
    <div className="perms-drawer">
      <OpenUiPanel
        className="perms-drawer__panel perms-drawer__panel--account"
        icon={<ShieldCheck size={17} aria-hidden="true" />}
        title={t("accountBindingTitle")}
        subtitle={t("accountBindingSubtitle")}
      >
        <OpenUiTextField
          className="perms-drawer__field"
          label={t("accountId")}
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          placeholder={t("accountIdHashPlaceholder")}
          hint={t("accountIdHint")}
          mono
          spellCheck={false}
          disabled={busy || Boolean(pendingTransaction)}
        />
        <OpenUiSegmented
          className="perms-drawer__lane"
          label={t("permissionLane")}
          value={lane}
          onChange={(value) => setLane(value as PermissionLane)}
          options={[
            { value: "verifier", label: t("verifierLane"), disabled: busy },
            { value: "hook", label: t("hookLane"), disabled: busy },
          ]}
        />
      </OpenUiPanel>

      <OpenUiPanel
        className="perms-drawer__panel perms-drawer__panel--target"
        icon={lane === "verifier" ? <KeyRound size={17} aria-hidden="true" /> : <PlugZap size={17} aria-hidden="true" />}
        title={t("targetBindingTitle", { lane: selectedLaneLabel })}
        subtitle={selectedPending ? t("pendingTargetLocked") : currentBinding ? t("rotationTargetSubtitle") : t("installTargetSubtitle")}
      >
        <OpenUiTextField
          className="perms-drawer__field"
          label={t("targetContractHash")}
          value={targetDraft}
          onChange={(event) => lane === "verifier"
            ? setVerifierTarget(event.target.value)
            : setHookTarget(event.target.value)}
          placeholder={t("targetHashPlaceholder")}
          hint={t("targetHashHint")}
          mono
          spellCheck={false}
          disabled={busy || selectedPending || Boolean(pendingTransaction)}
        />
        {lane === "verifier" ? (
          <OpenUiTextField
            className="perms-drawer__field"
            label={t("verifierParams")}
            value={verifierParams}
            onChange={(event) => setVerifierParams(event.target.value)}
            placeholder={t("verifierParamsPlaceholder")}
            hint={t("verifierParamsHint")}
            mono
            spellCheck={false}
            disabled={busy || selectedPending || Boolean(pendingTransaction)}
          />
        ) : null}
      </OpenUiPanel>

      <OpenUiNotice
        className="perms-drawer__notice"
        icon={currentBinding ? <Clock3 size={17} aria-hidden="true" /> : <PlugZap size={17} aria-hidden="true" />}
        title={currentBinding ? t("replacementUsesTimelock") : t("firstInstallIsImmediate")}
      >
        {currentBinding ? t("replacementTimelockDetail") : t("firstInstallDetail")}
      </OpenUiNotice>

      <OpenUiPanel
        className="perms-drawer__panel perms-drawer__panel--raw"
        icon={<Settings2 size={17} aria-hidden="true" />}
        title={t("technicalRecordTitle")}
        subtitle={t("technicalRecordSubtitle")}
      >
        <dl className="perms-raw-record">
          <div><dt>{t("networkLabel")}</dt><dd>{network}</dd></div>
          <div><dt>{t("aaCoreLabel")}</dt><dd>{aaCore || "—"}</dd></div>
          <div><dt>{t("inspectedAccountLabel")}</dt><dd>{bindingCurrent ? inspectedAccountId : "—"}</dd></div>
          <div><dt>{t("backupOwner")}</dt><dd>{bindingCurrent ? currentBackupOwner : "—"}</dd></div>
          <div><dt>{t("currentVerifier")}</dt><dd>{bindingCurrent ? currentVerifier || ZERO_HASH : "—"}</dd></div>
          <div><dt>{t("currentHook")}</dt><dd>{bindingCurrent ? currentHook || ZERO_HASH : "—"}</dd></div>
          <div><dt>{t("proposalTargetLabel")}</dt><dd>{proposalTarget || "—"}</dd></div>
          <div><dt>{t("transactionIdLabel")}</dt><dd>{pendingTxid || "—"}</dd></div>
          <div><dt>{t("walletNetworkLabel")}</dt><dd>{walletNetwork || t("notChecked")}</dd></div>
        </dl>
      </OpenUiPanel>
    </div>
  );

  return (
    <div className="perms-play-area mx2 mx2-cat-tool">
      <OpenUiProvider>
        <PlayStage
          category="tool"
          stage={{
            title: t("permissionsHeroTitle"),
            subtitle: t("permissionsHeroCopy"),
            badges: (
              <span className="perms-stage-badge">
                <ShieldCheck size={14} aria-hidden="true" />
                {network === "mainnet" ? t("neoMainnet") : t("neoTestnet")}
              </span>
            ),
          }}
          scene={scene}
          score={readout}
          actions={{ primary, secondary }}
          drawerToggleLabel={t("permissionSettings")}
          drawer={{ title: t("permissionSettings"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
