import { useEffect, useRef, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Button } from "@/components/ui/button";
import { useWalletStore, walletOptions, WalletProvider } from "@/lib/wallet/store";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";
import { LogOut, Wallet, Mail, X } from "lucide-react";
import { connectNeoX } from "./NeoXConnect";

export function ConnectButton() {
  const { user } = useUser();
  const wallet = useWalletStore();
  const auth = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Connect Modal State
  const [showConnectModal, setShowConnectModal] = useState(false);

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

  if (wallet.connected || auth.walletAddress) {
    const address = wallet.address || auth.walletAddress;
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/60 dark:bg-[#12131C]/60 border border-gray-200/80 dark:border-white/10 px-4 py-2 backdrop-blur-xl shadow-sm hover:border-neo/30 transition-colors group cursor-pointer">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neo opacity-75 duration-1000"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-neo border border-neo/50 shadow-[0_0_8px_rgba(0,229,153,0.8)]"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-bold text-gray-900 dark:text-white tracking-tight group-hover:text-neo transition-colors leading-tight" title={address}>
              {address.slice(0, 6)}...{address.slice(-4)}
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
    setShowConnectModal(false);
    await auth.loginWallet(provider);
  };

  const handleNeoXConnect = async () => {
    try {
      setShowConnectModal(false);
      useAuthStore.setState({ loading: true });
      const address = await connectNeoX();
      useAuthStore.setState({
        authenticated: true,
        method: "wallet",
        walletAddress: address,
        walletType: "external",
        loading: false,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Connection failed";
      useAuthStore.setState({ loading: false, error: message });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConnectModal(true)}
        disabled={wallet.loading || auth.loading}
        className="group relative flex items-center gap-2 rounded-xl bg-black/5 dark:bg-white/5 backdrop-blur-md px-5 py-2.5 text-sm font-bold text-gray-900 dark:text-white transition-all hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 shadow-[0_0_15px_rgba(0,229,153,0.1)] hover:shadow-[0_0_20px_rgba(0,229,153,0.3)] hover:border-neo/50 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo"
      >
        <span className="relative z-10">{wallet.loading || auth.loading ? "Connecting..." : "Log In / Sign Up"}</span>
      </button>

      {/* Polymarket-style Global Login Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConnectModal(false)}
            onKeyDown={(e) => e.key === "Escape" && setShowConnectModal(false)}
            role="button"
            tabIndex={0}
            aria-label="Close modal"
          />
          <div
            className="relative w-full max-w-[440px] rounded-3xl bg-white dark:bg-[#12131C] border border-gray-200 dark:border-white/10 shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Connect wallet"
          >
            <button
              onClick={() => setShowConnectModal(false)}
              aria-label="Close login modal"
              className="absolute right-6 top-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-500 cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Welcome to R3E</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Connect a wallet or sign in with email to continue.</p>
            </div>

            <div className="space-y-4">
              {/* Social / Email Login */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">Email & Social</p>
                <button
                  onClick={() => auth.loginSocial("google")}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1C25] px-4 py-3.5 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                  Continue with Google
                </button>
                <button
                  onClick={() => auth.loginSocial("github")}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1C25] px-4 py-3.5 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <img src="https://www.svgrepo.com/show/512317/github-142.svg" className="w-5 h-5 dark:invert" alt="GitHub" />
                  Continue with GitHub
                </button>
              </div>

              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
                <span className="flex-shrink-0 mx-4 text-xs text-gray-400 font-medium">OR</span>
                <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
              </div>

              {/* Neo Wallets */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">Neo Ecosystem</p>
                <div className="grid grid-cols-2 gap-3">
                  {walletOptions.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => handleConnect(w.id)}
                      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1C25] p-4 hover:border-neo hover:shadow-[0_0_15px_rgba(0,229,153,0.15)] transition-all group cursor-pointer"
                    >
                      <img
                        src={w.icon}
                        alt={w.name}
                        className="h-8 w-8 object-contain group-hover:scale-110 transition-transform"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                        }}
                      />
                      <Wallet className="fallback-icon hidden h-8 w-8 text-neo group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{w.name}</span>
                    </button>
                  ))}

                  {/* Neo X Option */}
                  <button
                    onClick={handleNeoXConnect}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1C25] p-4 hover:border-neo hover:shadow-[0_0_15px_rgba(0,229,153,0.15)] transition-all group cursor-pointer"
                  >
                    <div className="h-8 w-8 rounded-full bg-[#1A1C25] dark:bg-white flex items-center justify-center">
                      <span className="text-white dark:text-black font-black text-xs leading-none">X</span>
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Neo X</span>
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-8 text-center text-xs text-gray-400">
              By connecting, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {(wallet.error || auth.error) && (
        <div role="alert" className="fixed bottom-6 right-6 w-80 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/90 dark:bg-red-950/90 backdrop-blur-xl p-4 shadow-xl z-50 animate-in slide-in-from-bottom-5">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400 leading-tight mb-3">
            {wallet.error || auth.error}
          </p>
          <button
            type="button"
            onClick={() => { wallet.clearError(); auth.clearError(); }}
            className="block w-full text-center py-2 cursor-pointer text-xs font-bold text-red-500 dark:text-red-400 hover:text-white hover:bg-red-500 dark:hover:bg-red-500 transition-colors rounded-lg border border-red-200 dark:border-red-800"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
