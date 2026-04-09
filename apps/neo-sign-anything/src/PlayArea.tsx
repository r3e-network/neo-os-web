/**
 * PlayArea.tsx — React version of the Neo Sign Anything PlayArea.
 *
 * Composes SignHero, SignResultCards, and SignOperationPanel.
 * Uses useStateBindings hook instead of Vue computed properties.
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
  const { str, bool } = useStateBindings(state);
  const [message, setMessage] = useState("");

  const address = str("address", "");
  const signature = str("signature", "");
  const txHash = str("txHash", "");
  const isSigning = bool("isSigning");
  const isBroadcasting = bool("isBroadcasting");

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
