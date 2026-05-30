/**
 * PlayArea.tsx -- Dev Tipping
 *
 * Uses all state: developers, recentTips, totalDonated, isLoading,
 * address, developerCount, totalDonatedDisplay, recentTipCount.
 * Actions: sendTip, selectDev.
 * Keeps existing sub-components: TipList, TipForm.
 */

import { useState } from "react";
import { NeoCard } from "@shared/components-react";
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

  const handleSelectDev = (dev: Developer) => {
    setSelectedDevId(dev.id);
    dispatch("selectDev", dev);
  };

  const handleSendTip = async () => {
    if (!selectedDevId) return;
    await dispatch("sendTip", selectedDevId, tipAmount, tipMessage, tipperName, anonymous);
  };

  return (
    <div className="dev-tipping-play-area">
      {/* Hero: identity + stats + wallet */}
      <NeoCard variant="erobo" className="tipping-hero">
        <div className="tipping-hero__head">
          <span className="tipping-hero__badge" aria-hidden="true">♡</span>
          <div className="tipping-hero__text">
            <h2 className="tipping-hero__title">{t("title") || "Dev Tipping"}</h2>
            <p className="tipping-hero__subtitle">{t("docSubtitle") || t("subtitle")}</p>
          </div>
          <div className="tipping-hero__stats">
            <div className="tipping-stat">
              <span className="tipping-stat-value">{developerCount || developers.length}</span>
              <span className="tipping-stat-label">{t("developers") || "Developers"}</span>
            </div>
            <div className="tipping-stat">
              <span className="tipping-stat-value">{totalDonatedDisplay || formatNum(totalDonated)}</span>
              <span className="tipping-stat-label">{t("totalDonated") || "Total Donated"}</span>
            </div>
            <div className="tipping-stat">
              <span className="tipping-stat-value">{recentTipCount || recentTips.length}</span>
              <span className="tipping-stat-label">{t("recentTips") || "Recent Tips"}</span>
            </div>
          </div>
        </div>

        {address && (
          <div className="wallet-row">
            <span className="wallet-label">{t("wallet") || "Wallet"}</span>
            <span className="wallet-value">{address.slice(0, 8)}...{address.slice(-6)}</span>
          </div>
        )}
      </NeoCard>

      {/* Two-column body: developer list (main) + tip form (side) */}
      <div className="tipping-body">
        <div className="tipping-col">
          <h3 className="tipping-section-title">{t("topDevelopers") || "Top Developers"}</h3>
          {developers.length > 0 ? (
            <TipList developers={developers} formatNum={formatNum} onSelect={handleSelectDev} t={t} />
          ) : (
            <div className="tipping-empty">
              <span className="tipping-empty__icon" aria-hidden="true">♡</span>
              <span className="tipping-empty__title">{t("topDevelopers") || "Top Developers"}</span>
              <span className="tipping-empty__hint">{t("docSubtitle") || t("subtitle")}</span>
            </div>
          )}

          {recentTips.length > 0 && (
            <NeoCard title={t("recentTips") || "Recent Tips"} variant="erobo">
              <div className="recent-tips-list">
                {recentTips.slice(0, 5).map((tip, idx) => (
                  <div key={idx} className="recent-tip-item">
                    <span className="recent-tip-from">{String(tip.tipperName || t("anonymousOn") || "Anonymous")}</span>
                    <span className="recent-tip-amount">{formatNum(Number(tip.amount || 0))} GAS</span>
                  </div>
                ))}
              </div>
            </NeoCard>
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
              onSelectDev={(id: number) => setSelectedDevId(id)}
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
