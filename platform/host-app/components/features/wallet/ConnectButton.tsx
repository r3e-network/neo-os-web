import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWalletStore, walletOptions, WalletProvider } from "@/lib/wallet/store";

export function ConnectButton() {
  const { connected, address, balance, loading, error, connect, disconnect, clearError } = useWalletStore();
  const [showMenu, setShowMenu] = useState(false);

  const handleConnect = async (provider: WalletProvider) => {
    setShowMenu(false);
    await connect(provider);
  };

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          {balance && <span className="text-xs text-gray-500">{balance.gas} GAS</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button onClick={() => setShowMenu(!showMenu)} disabled={loading}>
        {loading ? "Connecting..." : "Connect Wallet"}
      </Button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border bg-white p-2 shadow-lg">
          {walletOptions.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => handleConnect(wallet.id)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100"
            >
              <span>{wallet.icon}</span>
              <span>{wallet.name}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={clearError} className="mt-2 text-xs text-red-500 underline">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
