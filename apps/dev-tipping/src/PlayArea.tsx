/**
 * PlayArea.tsx -- Dev Tipping
 *
 * Uses all state: developers, recentTips, totalDonated, isLoading,
 * address, developerCount, totalDonatedDisplay, recentTipCount.
 * Actions: sendTip.
 * Keeps existing sub-components: TipList, TipForm.
 */

import { useState } from "react";
import { NeoCard } from "@shared/components-react";
import { CategoryIcon } from "@shared/components-react/illustrations";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { formatNumber } from "@shared/utils/format";
import TipList from "./components/TipList";
import TipForm from "./components/TipForm";
import DeveloperPanel from "./components/DeveloperPanel";
import type { Developer } from "./composables/useDevTippingStats";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, num, str } = useStateBindings(state);
  const formatNum = (n: number | string) => formatNumber(n, 2);

  const developers = (state.developers?.get() ?? []) as Developer[];
  const recentTips = (state.recentTips?.get() ?? []) as Array<Record<string, unknown>>;
  const totalDonated = num("totalDonated");
  const isLoading = bool("isLoading");
  const address = str("address", "");
  const developerCount = num("developerCount");
  const totalDonatedDisplay = str("totalDonatedDisplay", "0");
  const recentTipCount = num("recentTipCount");
  const isRegistering = bool("isRegistering");
  const isWithdrawing = bool("isWithdrawing");
  const myDeveloperId = num("myDeveloperId");
  const myClaimableBalance = num("myClaimableBalance");
  const isConnecting = bool("isConnecting");

  const myCredit = num("myCredit");

  const [selectedDevId, setSelectedDevId] = useState<number | null>(null);
  const [tipAmount, setTipAmount] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const staleZeroTotalDisplay =
    totalDonated > 0 && /^0(?:[.,]0+)?(?:\s+GAS)?$/i.test(totalDonatedDisplay.trim());
  const totalDonatedValue =
    totalDonatedDisplay && !staleZeroTotalDisplay ? totalDonatedDisplay : formatNum(totalDonated);

  const handleSelectDev = (dev: Developer) => {
    // Selecting a developer is pure local state; no chain/notify round-trip.
    setSelectedDevId(dev.id);
  };

  const handleSendTip = async () => {
    if (!selectedDevId) return;
    const ok = (await dispatch(
      "sendTip",
      selectedDevId,
      tipAmount,
      anonymous,
    )) as unknown as boolean;
    // dispatch resolves to the action's runtime result (true on success).
    // Clear the form on success to prevent an accidental duplicate tip.
    if (ok) {
      setTipAmount("");
      setSelectedDevId(null);
    }
  };

  const handleRegisterDeveloper = (name: string, role: string) =>
    dispatch("registerDeveloper", name, role) as unknown as Promise<boolean>;

  const handleWithdrawTips = () => {
    if (myDeveloperId <= 0) return;
    void dispatch("withdrawTips", myDeveloperId);
  };

  const handleWithdrawCredit = () => {
    if (myCredit <= 0) return;
    void dispatch("withdrawCredit");
  };

  const handleConnectWallet = () => {
    void dispatch("connect");
  };

  const [addressCopied, setAddressCopied] = useState(false);
  const handleCopyAddress = () => {
    if (!address || !navigator.clipboard?.writeText) return;
    navigator.clipboard
      .writeText(address)
      .then(() => {
        setAddressCopied(true);
        window.setTimeout(() => setAddressCopied(false), 1500);
      })
      .catch(() => {
        setAddressCopied(false);
      });
  };

  return (
    <div className="dev-tipping-play-area">
      {/* Hero: identity + stats + wallet */}
      <NeoCard variant="erobo" className="tipping-hero">
        <picture className="tipping-hero__media" aria-hidden="true">
          <source srcSet="./banner.avif" type="image/avif" />
          <source srcSet="./banner.webp" type="image/webp" />
          <img src="./banner.jpg" alt="" loading="eager" decoding="async" />
        </picture>
        <div className="tipping-hero__shade" aria-hidden="true" />
        <div className="tipping-hero__head">
          <span className="tipping-hero__badge">
            <picture aria-hidden="true">
              <source srcSet="./logo.avif" type="image/avif" />
              <source srcSet="./logo.webp" type="image/webp" />
              <img src="./logo.jpg" alt="" loading="eager" decoding="async" />
            </picture>
          </span>
          <div className="tipping-hero__text">
            <span className="tipping-hero__eyebrow">{t("subtitle")}</span>
            <h2 className="tipping-hero__title">{t("title")}</h2>
            <p className="tipping-hero__subtitle">{t("docSubtitle") || t("subtitle")}</p>
          </div>
          <div className="tipping-hero__stats">
            <div className="tipping-stat">
              <span className="tipping-stat-value">{developerCount || developers.length}</span>
              <span className="tipping-stat-label">{t("developers")}</span>
            </div>
            <div className="tipping-stat">
              <span className="tipping-stat-value">{totalDonatedValue}</span>
              <span className="tipping-stat-label">{t("totalDonated")}</span>
            </div>
            <div className="tipping-stat">
              <span className="tipping-stat-value">{recentTipCount || recentTips.length}</span>
              <span className="tipping-stat-label">{t("recentTips")}</span>
            </div>
          </div>
        </div>
        <div className="tipping-hero__route" aria-label={t("tipRouteTitle")}>
          <span>{t("tipRouteDirect")}</span>
          <span>{t("tipRouteClaimable")}</span>
          <span>{t("tipRouteAnonymous")}</span>
        </div>

        {address && (
          <button
            type="button"
            className="wallet-row"
            onClick={handleCopyAddress}
            aria-label={`${t("wallet")} ${address}`}
          >
            <span className="wallet-label">{t("wallet")}</span>
            <span className="wallet-value">
              <span>{address.slice(0, 8)}...{address.slice(-6)}</span>
              <span className="wallet-copy-hint" aria-hidden="true">{addressCopied ? "✓" : "⧉"}</span>
            </span>
          </button>
        )}
      </NeoCard>

      {/* Two-column body: developer list (main) + tip form (side) */}
      <div className="tipping-body">
        <div className="tipping-col">
          <h3 className="tipping-section-title">{t("topDevelopers")}</h3>
          {developers.length > 0 ? (
            <TipList developers={developers} formatNum={formatNum} onSelect={handleSelectDev} t={t} />
          ) : (
            <>
              <div className="tipping-empty">
                <span className="tipping-empty__badge" aria-hidden="true">
                  <CategoryIcon name="social" size={58} title={t("title")} />
                </span>
                <span className="tipping-empty__title">{t("supportBoardTitle")}</span>
                <span className="tipping-empty__hint">{t("supportBoardHint") || t("noDevelopersHint")}</span>
                <div className="tipping-empty__route" aria-label={t("tipRouteTitle")}>
                  <span>{t("step2")}</span>
                  <span>{t("step3")}</span>
                  <span>{t("step4")}</span>
                </div>
              </div>

              <details className="tipping-guide">
                <summary className="tipping-guide__summary">
                  <span>{t("howItWorks")}</span>
                  <span className="tipping-guide__chevron" aria-hidden="true">⌄</span>
                </summary>
                <ol className="tipping-guide__steps">
                  <li className="tipping-guide__step">
                    <span className="tipping-guide__num">1</span>
                    <span className="tipping-guide__text">{t("step1")}</span>
                  </li>
                  <li className="tipping-guide__step">
                    <span className="tipping-guide__num">2</span>
                    <span className="tipping-guide__text">{t("step2")}</span>
                  </li>
                  <li className="tipping-guide__step">
                    <span className="tipping-guide__num">3</span>
                    <span className="tipping-guide__text">{t("step3")}</span>
                  </li>
                  <li className="tipping-guide__step">
                    <span className="tipping-guide__num">4</span>
                    <span className="tipping-guide__text">{t("step4")}</span>
                  </li>
                </ol>
              </details>
            </>
          )}

          {recentTips.length > 0 && (
            <details className="recent-tips">
              <summary className="recent-tips__summary">
                <span>{t("recentTips")}</span>
                <span className="recent-tips__count">{recentTips.length}</span>
                <span className="recent-tips__chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="recent-tips-list">
                {recentTips.slice(0, 5).map((tip, idx) => (
                  <div key={idx} className="recent-tip-item">
                    <span className="recent-tip-from">
                      {String(tip.tipperName || t("anonymousOn"))}
                      {tip.to ? (
                        <span className="recent-tip-to" title={t("tipRecipientHint")}>
                          {" → "}{String(tip.to)}
                        </span>
                      ) : null}
                    </span>
                    <span className="recent-tip-amount">{formatNum(Number(tip.amount || 0))} GAS</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="tipping-col">
          <h3 className="tipping-section-title">{t("sendTip")}</h3>
          <NeoCard variant="erobo">
            <TipForm
              developers={developers}
              selectedDevId={selectedDevId}
              amount={tipAmount}
              anonymous={anonymous}
              isLoading={isLoading}
              onSelectDev={(id: number | null) => setSelectedDevId(id)}
              onAmountChange={setTipAmount}
              onAnonymousChange={setAnonymous}
              onSubmit={handleSendTip}
              t={t}
            />
          </NeoCard>

          <h3 className="tipping-section-title">{t("developerZone")}</h3>
          <NeoCard variant="erobo">
            <DeveloperPanel
              connected={Boolean(address)}
              isConnecting={isConnecting}
              myDeveloperId={myDeveloperId}
              claimableBalance={myClaimableBalance}
              isRegistering={isRegistering}
              isWithdrawing={isWithdrawing}
              onConnect={handleConnectWallet}
              onRegister={handleRegisterDeveloper}
              onWithdraw={handleWithdrawTips}
              formatNum={formatNum}
              t={t}
            />

            {/* Exit path for stranded tip credit: a deposit that landed but
                whose tip step failed persists as reusable prepaid credit. The
                contract exposes withdraw(account) — surface it so the money-out
                path the tipPrepaidNoTip copy promises actually exists. */}
            {myCredit > 0 && (
              <div className="tipping-credit-row">
                <span className="tipping-credit-label">
                  {t("unusedCredit")}: <strong>{formatNum(myCredit)} {t("tokenGas")}</strong>
                </span>
                <button
                  type="button"
                  className="tipping-credit-withdraw"
                  disabled={isWithdrawing}
                  onClick={handleWithdrawCredit}
                >
                  {t("withdrawCredit")}
                </button>
              </div>
            )}
          </NeoCard>
        </div>
      </div>
    </div>
  );
}
