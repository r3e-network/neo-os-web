import { useEffect, useMemo, useState } from "react";
import { Code2, HeartHandshake, Send, Wallet } from "lucide-react";
import { CoinArt, ParticleBurst } from "@shared/art";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import type { ObservableState } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { formatHash } from "@shared/utils/format";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

interface Dev {
  id: string | number;
  name?: string;
  role?: string;
  wallet?: string;
  totalTips?: number | string;
  tipCount?: number;
  balance?: number;
}

interface RecentTip {
  id: string;
  tipperName?: string;
  to?: string;
  amount?: string;
}

type DrawerMode = "developers" | "direct" | "developer" | "history";

const TIP_PRESETS = ["0.01", "0.10", "0.50", "1.00"];
const EMPTY_DEVELOPERS: Dev[] = [];
const EMPTY_RECENT_TIPS: RecentTip[] = [];

function isValidTipAmount(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) return false;
  const amount = Number(trimmed);
  return Number.isFinite(amount) && amount >= 0.001;
}

function gasDisplay(value: unknown): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? `${amount.toFixed(2)} GAS` : "0.00 GAS";
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  const address = str("address");
  const developers = val<Dev[]>("developers", EMPTY_DEVELOPERS) ?? EMPTY_DEVELOPERS;
  const recentTips = val<RecentTip[]>("recentTips", EMPTY_RECENT_TIPS) ?? EMPTY_RECENT_TIPS;
  const totalDonatedDisplay = str("totalDonatedDisplay") || gasDisplay(num("totalDonated"));
  const myDeveloperId = num("myDeveloperId");
  const myClaimableBalance = num("myClaimableBalance");
  const myCredit = num("myCredit");
  const isLoading = bool("isLoading");
  const isRegistering = bool("isRegistering");
  const isWithdrawing = bool("isWithdrawing");
  const isConnecting = bool("isConnecting");

  const [selectedDevId, setSelectedDevId] = useState("");
  const [tipAmount, setTipAmount] = useState("0.10");
  const [anonymous, setAnonymous] = useState(true);
  const [devName, setDevName] = useState("");
  const [devRole, setDevRole] = useState("");
  const [sendPulse, setSendPulse] = useState(0);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("developers");

  useEffect(() => {
    if (!selectedDevId && developers[0]) {
      setSelectedDevId(String(developers[0].id));
    }
  }, [developers, selectedDevId]);

  const selectedDeveloper = useMemo(
    () => developers.find((dev) => String(dev.id) === selectedDevId),
    [developers, selectedDevId],
  );
  const featuredDevelopers = developers.slice(0, 3);
  const canTip = Boolean(address && selectedDevId && isValidTipAmount(tipAmount));
  const busy = isLoading || isRegistering || isWithdrawing || isConnecting;
  const supporterLabel = address ? formatHash(address, 6) : t("walletNotConnected");
  const recipientLabel = selectedDeveloper?.name || (selectedDevId ? t("defaultDevName", { id: selectedDevId }) : t("tipRecipientPending"));
  const sceneStatus = isLoading
    ? t("sending")
    : !address
      ? t("connectWallet")
      : canTip
        ? t("directTipRoute")
        : t("sendTipBtnIdle");
  const drawerTabs = [
    {
      mode: "developers" as const,
      label: t("developers"),
      meta: `${developers.length} ${t("supportStageDevelopers")}`,
      icon: <Code2 size={15} />,
    },
    {
      mode: "direct" as const,
      label: t("supportTabDirect"),
      meta: selectedDevId ? `#${selectedDevId}` : t("developerIdPlaceholder"),
      icon: <Send size={15} />,
    },
    {
      mode: "developer" as const,
      label: t("supportTabCreator"),
      meta: myDeveloperId > 0 ? `#${myDeveloperId}` : t("registerHintShort"),
      icon: <Wallet size={15} />,
    },
    {
      mode: "history" as const,
      label: t("supportTabHistory"),
      meta: totalDonatedDisplay,
      icon: <HeartHandshake size={15} />,
    },
  ];

  const sendTip = async () => {
    if (!canTip || busy) return;
    setSendPulse((tick) => tick + 1);
    await dispatch("sendTip", Number(selectedDevId), tipAmount.trim(), anonymous);
  };

  const registerDeveloper = () => {
    if (!devName.trim() || isRegistering) return;
    void dispatch("registerDeveloper", devName.trim(), devRole.trim());
  };

  const scene = (
    <div className="tip-scene" data-state={isLoading ? "sending" : developers.length ? "active" : "empty"}>
      <figure className="tip-scene__stage-card" aria-label={t("supportBoardStageLabel")}>
        <img className="tip-scene__stage-image" src="./support-board-stage.webp" alt={t("supportBoardStageAlt")} />
        <figcaption className="tip-scene__stage-caption">
          <span>{t("supportStageEyebrow")}</span>
          <strong>{recipientLabel}</strong>
          <small>{selectedDeveloper?.role || t("supportDeskCopy")}</small>
        </figcaption>
        <div className="tip-scene__route-strip" aria-label={t("tipRouteTitle")}>
          <span><Wallet size={15} /> {supporterLabel}</span>
          <em>{tipAmount || "0"} GAS</em>
          <span><Code2 size={15} /> {recipientLabel}</span>
        </div>
      </figure>

      <section className="tip-scene__desk" aria-label={t("supportDeskTitle")}>
        <header className="tip-scene__desk-head">
          <span>{t("supportDeskTitle")}</span>
          <strong>{tipAmount || "0"} GAS</strong>
        </header>

        <div className="tip-scene__builder-rack" aria-label={t("selectDeveloper")}>
          {featuredDevelopers.length ? (
            featuredDevelopers.map((dev) => {
              const active = String(dev.id) === selectedDevId;
              return (
                <button
                  key={String(dev.id)}
                  type="button"
                  className={active ? "is-active" : ""}
                  onClick={() => setSelectedDevId(String(dev.id))}
                  disabled={busy}
                >
                  <span className="tip-scene__builder-face"><Code2 size={18} /></span>
                  <span className="tip-scene__builder-copy">
                    <strong>{dev.name || t("defaultDevName", { id: String(dev.id) })}</strong>
                    <small>{dev.role || t("defaultDevRole")}</small>
                  </span>
                  <em>{gasDisplay(dev.totalTips)}</em>
                </button>
              );
            })
          ) : (
            <div className="tip-scene__empty-board">
              <strong>{t("supportBoardTitle")}</strong>
              <span>{t("noDevelopersHint")}</span>
            </div>
          )}
        </div>

        <section className="tip-scene__amount-board" aria-label={t("tipPresetLabel")}>
          <div className="tip-scene__amounts" role="radiogroup" aria-label={t("tipPresetLabel")}>
            {TIP_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={tipAmount === preset ? "is-active" : ""}
                aria-checked={tipAmount === preset}
                role="radio"
                onClick={() => setTipAmount(preset)}
                disabled={busy}
              >
                <CoinArt size={30} variant="gas" />
                <strong>{preset}</strong>
              </button>
            ))}
          </div>
          <div className="tip-scene__custom-amount" role="group" aria-label={t("customAmount")}>
            <span>{t("customAmount")}</span>
            <label className="tip-scene__custom-control">
              <input
                value={tipAmount}
                onChange={(event) => setTipAmount(event.target.value)}
                inputMode="decimal"
                disabled={busy}
                aria-label={t("tipAmount")}
              />
              <em>GAS</em>
            </label>
          </div>
        </section>

        <button
          type="button"
          className="tip-toggle tip-scene__visibility"
          data-active={anonymous}
          onClick={() => setAnonymous((value) => !value)}
          disabled={busy}
        >
          <HeartHandshake size={18} />
          <span>{anonymous ? t("anonymousOn") : t("anonymousOff")}</span>
        </button>

        {isLoading && (
          <div className="tip-scene__coin-lane" aria-hidden="true" data-pulse={sendPulse}>
            <span className="tip-scene__lane-line" />
            <CoinArt size={30} variant="gas" className="mx2-fly-coin" />
          </div>
        )}
      </section>

      {isLoading && <ParticleBurst coins count={8} className="tip-scene__burst" />}
      {(isLoading || canTip) && (
        <p className="tip-scene__status" aria-live="polite">
          {sceneStatus}
        </p>
      )}
    </div>
  );

  const drawerPanel = (() => {
    if (drawerMode === "developers") {
      return (
        <OpenUiPanel
          className="tip-drawer__panel tip-drawer__panel--developers"
          icon={<Code2 size={16} />}
          title={t("developers")}
          subtitle={`${developers.length} ${t("supportStageDevelopers")}`}
          titleId="tip-drawer-developers"
        >
          {developers.length ? (
            <div className="tip-builder-list">
              {developers.slice(0, 8).map((dev) => {
                const active = String(dev.id) === selectedDevId;
                return (
                  <button
                    key={String(dev.id)}
                    type="button"
                    className={active ? "is-active" : ""}
                    onClick={() => setSelectedDevId(String(dev.id))}
                  >
                    <span className="tip-builder-list__face"><Code2 size={18} /></span>
                    <span>
                      <strong>{dev.name || t("defaultDevName", { id: String(dev.id) })}</strong>
                      <small>{dev.role || t("defaultDevRole")}</small>
                    </span>
                    <em>{gasDisplay(dev.totalTips)}</em>
                  </button>
                );
              })}
            </div>
          ) : (
            <OpenUiNotice className="tip-drawer__notice" icon={<HeartHandshake size={17} />} title={t("supportBoardTitle")}>
              {t("supportBoardHint")}
            </OpenUiNotice>
          )}
        </OpenUiPanel>
      );
    }

    if (drawerMode === "direct") {
      return (
        <OpenUiPanel
          className="tip-drawer__panel tip-drawer__panel--direct"
          icon={<Send size={16} />}
          title={t("directSupportTitle")}
          subtitle={selectedDevId ? t("defaultDevName", { id: selectedDevId }) : t("developerIdPlaceholder")}
          titleId="tip-drawer-direct"
        >
          <OpenUiTextField
            className="tip-drawer-field tip-drawer-field--id"
            inputClassName="tip-drawer-input tip-drawer-input--developer-id"
            label={t("developerIdPlaceholder")}
            value={selectedDevId}
            onChange={(event) => setSelectedDevId(event.target.value)}
            inputMode="numeric"
            placeholder="1"
            disabled={busy}
            hint={t("developerIdHelp")}
          />
        </OpenUiPanel>
      );
    }

    if (drawerMode === "developer") {
      return (
        <OpenUiPanel
          className="tip-drawer__panel tip-drawer__panel--developer"
          icon={<Wallet size={16} />}
          title={t("developerZone")}
          subtitle={myDeveloperId > 0 ? `${t("registeredAs")} #${myDeveloperId}` : t("registerHint")}
          titleId="tip-drawer-zone"
        >
          {myDeveloperId > 0 ? (
            <div className="tip-dev-zone">
              <strong>{t("registeredAs")} #{myDeveloperId}</strong>
              <span>{t("claimableBalance")}: {gasDisplay(myClaimableBalance)}</span>
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("withdrawTips", myDeveloperId)}
                disabled={myClaimableBalance <= 0 || isWithdrawing}
              >
                {isWithdrawing ? t("withdrawing") : t("withdrawTipsBtn")}
              </button>
            </div>
          ) : (
            <div className="tip-dev-zone">
              <div className="tip-dev-zone__fields">
                <OpenUiTextField
                  className="tip-drawer-field tip-drawer-field--name"
                  inputClassName="tip-drawer-input tip-drawer-input--dev-name"
                  label={t("devNameLabel")}
                  value={devName}
                  onChange={(event) => setDevName(event.target.value)}
                  placeholder={t("devNamePlaceholder")}
                />
                <OpenUiTextField
                  className="tip-drawer-field tip-drawer-field--role"
                  inputClassName="tip-drawer-input tip-drawer-input--dev-role"
                  label={t("devRoleLabel")}
                  value={devRole}
                  onChange={(event) => setDevRole(event.target.value)}
                  placeholder={t("devRolePlaceholder")}
                />
              </div>
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={registerDeveloper}
                disabled={!address || !devName.trim() || isRegistering}
              >
                {isRegistering ? t("registering") : t("registerBtn")}
              </button>
            </div>
          )}
          {myCredit > 0 && (
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              onClick={() => void dispatch("withdrawCredit")}
              disabled={isWithdrawing}
            >
              {t("withdrawCredit")} ({gasDisplay(myCredit)})
            </button>
          )}
        </OpenUiPanel>
      );
    }

    return (
      <OpenUiPanel
        className="tip-drawer__panel tip-drawer__panel--history"
        icon={<HeartHandshake size={16} />}
        title={t("recentTips")}
        subtitle={totalDonatedDisplay}
        titleId="tip-drawer-recent"
      >
        {recentTips.length ? (
          <ul className="mx2-history">
            {recentTips.slice(0, 8).map((tip) => (
              <li key={tip.id} className="mx2-history__item">
                <span className="mx2-history__face">{tip.tipperName || t("anonymousOn")}</span>
                <span className="mx2-history__stake">{tip.to}</span>
                <span className="mx2-history__result">{tip.amount} GAS</span>
              </li>
            ))}
          </ul>
        ) : (
          <OpenUiNotice className="tip-drawer__notice" icon={<HeartHandshake size={17} />} title={t("noDevelopers")}>
            {t("supportBoardHint")}
          </OpenUiNotice>
        )}
      </OpenUiPanel>
    );
  })();

  const drawer = (
    <div className="tip-drawer">
      <div className="tip-drawer__tabs" role="tablist" aria-label={t("supportOptions")}>
        {drawerTabs.map((item) => (
          <button
            key={item.mode}
            type="button"
            role="tab"
            aria-selected={drawerMode === item.mode}
            className={drawerMode === item.mode ? "is-active" : ""}
            onClick={() => setDrawerMode(item.mode)}
          >
            <span className="tip-drawer__tab-icon">{item.icon}</span>
            <strong>{item.label}</strong>
            <small>{item.meta}</small>
          </button>
        ))}
      </div>
      <div className="tip-drawer__active" data-mode={drawerMode}>
        {drawerPanel}
      </div>
    </div>
  );

  return (
    <div className="dev-tip-play-area mx2 mx2-cat-tool">
      <OpenUiProvider>
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("supportStageEyebrow"),
            title: t("supportStageTitle"),
            subtitle: t("supportStageCopy"),
            badges: (
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {developers.length} {t("supportStageDevelopers")}
              </span>
            ),
          }}
          scene={scene}
          actions={{
            primary: address
              ? {
                  label: isLoading ? t("sending") : t("sendTipBtn"),
                  onClick: () => void sendTip(),
                  disabled: !canTip || busy,
                  loading: isLoading,
                  icon: <Send size={17} />,
                  hint: canTip ? undefined : t("sendTipHint"),
                }
              : {
                  label: isConnecting ? t("connecting") : t("connectWallet"),
                  onClick: () => void dispatch("connect"),
                  loading: isConnecting,
                  icon: <Wallet size={17} />,
                },
            secondary: address && myDeveloperId > 0
              ? [{
                  label: t("withdrawTipsBtn"),
                  onClick: () => void dispatch("withdrawTips", myDeveloperId),
                  disabled: myClaimableBalance <= 0 || isWithdrawing,
                  loading: isWithdrawing,
                }]
              : undefined,
          }}
          drawerToggleLabel={t("supportOptions")}
          drawer={{ title: t("supportOptions"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
