import { useEffect, useRef, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Button } from "@/components/ui/button";
import { useWalletStore, walletOptions, WalletProvider } from "@/lib/wallet/store";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";
import { LogOut, Wallet } from "lucide-react";

export function ConnectButton() {
  const { user } = useUser();
  const wallet = useWalletStore();
  const auth = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMenu]);

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-gray-100/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 px-4 py-2 backdrop-blur-md shadow-sm">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neo opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-neo border border-neo/50 shadow-[0_0_8px_rgba(0,229,153,0.8)]"></span>
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">{user.email || user.name || "Connected"}</span>
        </div>
        <button
          type="button"
          onClick={() => auth.logout()}
          className="p-2.5 rounded-xl border border-transparent hover:border-red-200/50 dark:hover:border-red-500/30 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 group"
          aria-label="Logout"
        >
          <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
        </button>
      </div>
    );
  }

  if (wallet.connected) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/60 dark:bg-[#12131C]/60 border border-gray-200/80 dark:border-white/10 px-4 py-2 backdrop-blur-xl shadow-sm hover:border-neo/30 transition-colors group cursor-pointer">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neo opacity-75 duration-1000"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-neo border border-neo/50 shadow-[0_0_8px_rgba(0,229,153,0.8)]"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-bold text-gray-900 dark:text-white tracking-tight group-hover:text-neo transition-colors leading-tight" title={wallet.address}>
              {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
            </span>
            {wallet.balance && <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{wallet.balance.gas} GAS</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => auth.logout()}
          className="p-2.5 rounded-xl border border-transparent hover:border-rose-200/50 dark:hover:border-rose-500/30 text-gray-500 dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 group"
          aria-label="Disconnect"
        >
          <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
        </button>
      </div>
    );
  }

  const handleConnect = async (provider: WalletProvider) => {
    setShowMenu(false);
    await auth.loginWallet(provider);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        disabled={wallet.loading}
        aria-haspopup="true"
        aria-expanded={showMenu}
        className="group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all hover:shadow-[0_6px_25px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 opacity-0 transition-opacity group-hover:opacity-100" />
        <Wallet size={16} className="relative z-10 opacity-80 group-hover:opacity-100" />
        <span className="relative z-10">{wallet.loading ? "Connecting..." : "Connect"}</span>
      </button>

      <div
        className={cn(
          "absolute right-0 top-[calc(100%+12px)] w-60 rounded-2xl border border-gray-200/50 dark:border-white/10 bg-white/90 dark:bg-[#0A0B10]/90 backdrop-blur-2xl shadow-2xl z-50 transform origin-top-right transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] p-2",
          showMenu ? "scale-100 opacity-100 pointer-events-auto" : "scale-95 opacity-0 pointer-events-none"
        )}
        role="menu"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-2xl" />
        <div className="relative z-10">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 px-4 py-2 mb-1">Select Wallet</div>
          <div className="space-y-1">
            {walletOptions.map((w) => (
              <button
                type="button"
                role="menuitem"
                key={w.id}
                onClick={() => handleConnect(w.id)}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo border border-transparent hover:border-gray-200/80 dark:hover:border-white/10 hover:bg-gray-50/80 dark:hover:bg-white/5 hover:shadow-sm"
              >
                <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 border border-gray-100 dark:border-white/10 bg-white shadow-sm p-1 group-hover:scale-105 transition-transform duration-300">
                  <img src={w.icon} alt={w.name} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.src = "/wallet-default.svg"; }} />
                </div>
                <span className="font-bold text-gray-800 dark:text-gray-200 text-sm group-hover:text-neo dark:group-hover:text-neo transition-colors">{w.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {wallet.error && (
        <div role="alert" className="absolute right-0 top-[calc(100%+12px)] w-72 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/90 dark:bg-red-950/90 backdrop-blur-xl p-4 shadow-xl z-50">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400 leading-tight">{wallet.error}</p>
          <button
            type="button"
            onClick={wallet.clearError}
            className="mt-3 block w-full text-center py-1.5 cursor-pointer text-xs font-bold text-red-500 dark:text-red-400 hover:text-white hover:bg-red-500 dark:hover:bg-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg border border-red-200 dark:border-red-800"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
