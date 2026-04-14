/**
 * PlayArea.tsx — Neo Sign Anything
 *
 * Full interactive signing console: stats bar with sign/broadcast counts,
 * hero section, result cards, and operation panel with sign/broadcast actions.
 */

import { useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import SignHero from "./components/SignHero";
import SignResultCards from "./components/SignResultCards";
import SignOperationPanel from "./components/SignOperationPanel";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num } = useStateBindings(state);
  const [message, setMessage] = useState("");

  const address = str("address", "");
  const signature = str("signature", "");
  const txHash = str("txHash", "");
  const isSigning = bool("isSigning");
  const isBroadcasting = bool("isBroadcasting");
  const signCount = num("signCount");
  const broadcastCount = num("broadcastCount");

  const handleSign = async () => {
    await dispatch("signMessage", message);
  };

  const handleBroadcast = async () => {
    await dispatch("broadcastMessage", message);
  };

  const handleCopy = async (text: string) => {
    await dispatch("copyToClipboard", text);
  };

  return (
    <div className="sign-play-area">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-value">{signCount}</span>
          <span className="stat-label">{t("signCount") || "Signed"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{broadcastCount}</span>
          <span className="stat-label">{t("broadcastCount") || "Broadcast"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{address ? address.slice(0, 8) + "..." : "--"}</span>
          <span className="stat-label">{t("walletAddress") || "Wallet"}</span>
        </div>
      </div>

      <SignHero t={t} />

      <SignResultCards
        t={t}
        signature={signature}
        txHash={txHash}
        onCopy={handleCopy}
      />

      <SignOperationPanel
        t={t}
        message={message}
        address={address}
        isSigning={isSigning}
        isBroadcasting={isBroadcasting}
        onUpdateMessage={setMessage}
        onSign={handleSign}
        onBroadcast={handleBroadcast}
      />
    </div>
  );
}
