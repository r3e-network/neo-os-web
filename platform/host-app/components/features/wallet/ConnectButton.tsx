import { useEffect, useRef, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Button } from "@/components/ui/button";
import { useWalletStore, walletOptions, WalletProvider } from "@/lib/wallet/store";
import { useAuthStore } from "@/lib/auth/store";

export function ConnectButton() {
  const { user } = useUser();
  const wallet = useWalletStore();
  const auth = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) {
      return;
    }

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
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 dark:bg-gray-800">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium dark:text-white">{user.email || user.name || "Connected"}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => auth.logout()}>
          Logout
        </Button>
      </div>
    );
  }

  if (wallet.connected) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 dark:bg-gray-800">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium dark:text-white" title={wallet.address}>
            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          </span>
          {wallet.balance && <span className="text-xs text-gray-500 dark:text-gray-400">{wallet.balance.gas} GAS</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => auth.logout()}>
          Disconnect
        </Button>
      </div>
    );
  }

  const handleConnect = async (provider: WalletProvider) => {
    setShowMenu(false);
    await auth.loginWallet(provider);
  };

  return (
    <div ref={menuRef} className="relative">
      <Button
        onClick={() => setShowMenu(!showMenu)}
        disabled={wallet.loading}
        aria-haspopup="true"
        aria-expanded={showMenu}
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
      >
        {wallet.loading ? "Connecting..." : "Connect Wallet"}
      </Button>

      {showMenu && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-xl z-50 dark:bg-gray-900 dark:border-gray-700">
          <div className="text-xs text-gray-500 px-3 py-1 mb-1 dark:text-gray-400">Select Wallet</div>
          {walletOptions.map((w) => (
            <button
              type="button"
              role="menuitem"
              key={w.id}
              onClick={() => handleConnect(w.id)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-left text-sm hover:bg-gray-100 transition-colors dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
            >
              <img src={w.icon} alt={w.name} width={24} height={24} className="w-6 h-6 rounded-full" onError={(e) => { e.currentTarget.src = "/wallet-default.svg"; }} />
              <span className="font-medium text-gray-800 dark:text-white">{w.name}</span>
            </button>
          ))}
        </div>
      )}

      {wallet.error && (
        <div role="alert" className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{wallet.error}</p>
          <button
            type="button"
            onClick={wallet.clearError}
            className="mt-2 cursor-pointer text-xs text-red-500 underline dark:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
