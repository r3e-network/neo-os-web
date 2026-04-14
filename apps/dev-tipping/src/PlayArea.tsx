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
      {/* Stats bar */}
      <div className="tipping-stats">
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

      {/* Wallet info */}
      {address && (
        <NeoCard variant="erobo" className="wallet-card">
          <div className="wallet-row">
            <span className="wallet-label">Wallet</span>
            <span className="wallet-value">{address.slice(0, 8)}...{address.slice(-6)}</span>
          </div>
        </NeoCard>
      )}

      {/* Developer list */}
      <TipList developers={developers} formatNum={formatNum} onSelect={handleSelectDev} t={t} />

      {/* Recent tips */}
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

      {/* Tip form */}
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
    </div>
  );
}
