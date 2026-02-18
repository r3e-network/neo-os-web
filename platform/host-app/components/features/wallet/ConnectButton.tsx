import { useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Button } from "@/components/ui/button";
import { useWalletStore, walletOptions, WalletProvider } from "@/lib/wallet/store";
import { useAuthStore } from "@/lib/auth/store";

export function ConnectButton() {
  const { user } = useUser();
  const wallet = useWalletStore();
  const auth = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium">{user.email || user.name || "Connected"}</span>
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
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium">
            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          </span>
          {wallet.balance && <span className="text-xs text-gray-500">{wallet.balance.gas} GAS</span>}
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
    <div className="relative">
      <Button
        onClick={() => setShowMenu(!showMenu)}
        disabled={wallet.loading}
        className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2"
      >
        {wallet.loading ? "Connecting..." : "Connect Wallet"}
      </Button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-xl z-50">
          <div className="text-xs text-gray-500 px-3 py-1 mb-1">Select Wallet</div>
          {walletOptions.map((w) => (
            <button
              key={w.id}
              onClick={() => handleConnect(w.id)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm hover:bg-gray-100 transition-colors"
            >
              <img src={w.icon} alt={w.name} className="w-6 h-6 rounded" onError={(e) => { e.currentTarget.src = "/wallet-default.svg"; }} />
              <span className="font-medium text-gray-800">{w.name}</span>
            </button>
          ))}
        </div>
      )}

      {wallet.error && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">{wallet.error}</p>
          <button onClick={wallet.clearError} className="mt-2 text-xs text-red-500 underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}
