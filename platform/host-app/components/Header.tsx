import React from "react";
import { WalletState } from "./types";

type Props = {
  wallet: WalletState;
  onConnect: () => void;
};

export function Header({ wallet, onConnect }: Props) {
  return (
    <header className="sticky top-0 z-[100] flex justify-between items-center px-6 py-4 bg-white dark:bg-black border-b-4 border-black dark:border-white shadow-brutal-md">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-neo border-2 border-black flex items-center justify-center font-black text-white text-xl shadow-brutal-sm rotate-[-3deg]">
          N
        </div>
        <span className="text-xl font-black uppercase tracking-tighter">
          Neo <span className="text-neo">MiniApps</span>
        </span>
      </div>
      <button
        onClick={onConnect}
        className="brutal-btn px-6 py-2"
      >
        {wallet.connected ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : "Connect Wallet"}
      </button>
    </header>
  );
}
