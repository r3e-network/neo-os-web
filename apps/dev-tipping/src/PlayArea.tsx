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
import { CategoryIcon, EmptyStateArt } from "@shared/components-react/illustrations";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { formatNumber } from "@shared/utils/format";
import TipList from "./components/TipList";
import TipForm from "./components/TipForm";
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

  const [selectedDevId, setSelectedDevId] = useState<number | null>(null);
  const [tipAmount, setTipAmount] = useState("");
  const [tipMessage, setTipMessage] = useState("");
  const [tipperName, setTipperName] = useState("");
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
      tipMessage,
      tipperName,
      anonymous,
    )) as unknown as boolean;
    // dispatch resolves to the action's runtime result (true on success).
    // Clear the form on success to prevent an accidental duplicate tip.
    if (ok) {
      setTipAmount("");
      setTipMessage("");
      setTipperName("");
      setSelectedDevId(null);
    }
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
        <div className="tipping-hero__head">
          <span className="tipping-hero__badge">
            <CategoryIcon name="social" size={40} title={t("title") || "Dev Tipping"} />
          </span>
          <div className="tipping-hero__text">
            <span className="tipping-hero__eyebrow">{t("subtitle") || "Support developers"}</span>
            <h2 className="tipping-hero__title">{t("title") || "Dev Tipping"}</h2>
            <p className="tipping-hero__subtitle">{t("docSubtitle") || t("subtitle")}</p>
          </div>
          <div className="tipping-hero__stats">
            <div className="tipping-stat">
              <span className="tipping-stat-value">{developerCount || developers.length}</span>
              <span className="tipping-stat-label">{t("developers") || "Developers"}</span>
            </div>
            <div className="tipping-stat">
              <span className="tipping-stat-value">{totalDonatedValue}</span>
              <span className="tipping-stat-label">{t("totalDonated") || "Total Donated"}</span>
            </div>
            <div className="tipping-stat">
              <span className="tipping-stat-value">{recentTipCount || recentTips.length}</span>
              <span className="tipping-stat-label">{t("recentTips") || "Recent Tips"}</span>
            </div>
          </div>
        </div>

        {address && (
          <button
            type="button"
            className="wallet-row"
            onClick={handleCopyAddress}
            aria-label={`${t("wallet") || "Wallet"} ${address}`}
          >
            <span className="wallet-label">{t("wallet") || "Wallet"}</span>
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
          <h3 className="tipping-section-title">{t("topDevelopers") || "Top Developers"}</h3>
          {developers.length > 0 ? (
            <TipList developers={developers} formatNum={formatNum} onSelect={handleSelectDev} t={t} />
          ) : (
            <>
              <div className="tipping-empty">
                <EmptyStateArt size={150} title={t("noDevelopers") || "No developers yet"} />
                <span className="tipping-empty__title">{t("noDevelopers") || "No developers yet"}</span>
                <span className="tipping-empty__hint">{t("noDevelopersHint") || t("docSubtitle")}</span>
              </div>

              <details className="tipping-guide">
                <summary className="tipping-guide__summary">
                  <span>{t("howItWorks") || "How it works"}</span>
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
                <span>{t("recentTips") || "Recent Tips"}</span>
                <span className="recent-tips__count">{recentTips.length}</span>
                <span className="recent-tips__chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="recent-tips-list">
                {recentTips.slice(0, 5).map((tip, idx) => (
                  <div key={idx} className="recent-tip-item">
                    <span className="recent-tip-from">
                      {String(tip.tipperName || t("anonymousOn") || "Anonymous")}
                      {tip.to ? <span className="recent-tip-to"> → {String(tip.to)}</span> : null}
                    </span>
                    <span className="recent-tip-amount">{formatNum(Number(tip.amount || 0))} GAS</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="tipping-col">
          <h3 className="tipping-section-title">{t("sendTip") || "Send Tip"}</h3>
          <NeoCard variant="erobo">
            <TipForm
              developers={developers}
              selectedDevId={selectedDevId}
              amount={tipAmount}
              message={tipMessage}
              tipperName={tipperName}
              anonymous={anonymous}
              isLoading={isLoading}
              onSelectDev={(id: number | null) => setSelectedDevId(id)}
              onAmountChange={setTipAmount}
              onMessageChange={setTipMessage}
              onTipperNameChange={setTipperName}
              onAnonymousChange={setAnonymous}
              onSubmit={handleSendTip}
              t={t}
            />
          </NeoCard>
        </div>
      </div>
    </div>
  );
}
