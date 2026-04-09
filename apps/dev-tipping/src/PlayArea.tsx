import { useState } from "react";
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
  const { bool } = useStateBindings(state);
  const formatNum = (n: number | string) => formatNumber(n, 2);
  const developers = (state.developers?.get() ?? []) as Developer[];
  const isLoading = bool("isLoading");

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
      <TipList developers={developers} formatNum={formatNum} onSelect={handleSelectDev} t={t} />
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
