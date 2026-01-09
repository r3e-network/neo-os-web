import React from "react";
import { WalletState } from "./types";

type Props = {
  wallet: WalletState;
  onConnect: () => void;
};

export function Header({ wallet, onConnect }: Props) {
  return (
    <header className="sticky top-0 z-[100] flex justify-between items-center px-6 py-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-white/10 shadow-sm transition-all">
      <div className="flex items-center gap-3 group cursor-pointer">
        <div className="w-10 h-10 bg-neo text-black flex items-center justify-center font-bold text-xl rounded-full shadow-[0_0_15px_rgba(0,229,153,0.3)] transition-transform group-hover:scale-105">
          N
        </div>
        <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Neo <span className="text-neo">MiniApps</span>
        </span>
      </div>
      <button
        onClick={onConnect}
        className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-300 ${wallet.connected
            ? "bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/20"
            : "bg-neo text-black hover:bg-neo-dark shadow-[0_0_15px_rgba(0,229,153,0.3)] hover:shadow-[0_0_20px_rgba(0,229,153,0.5)]"
          }`}
      >
        {wallet.connected ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : "Connect Wallet"}
      </button>
    </header>
  );
}
