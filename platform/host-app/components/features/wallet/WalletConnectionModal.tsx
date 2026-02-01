import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, User, ExternalLink } from "lucide-react";
import type { WalletProvider } from "@/lib/wallet/store";
import { useWalletStore, walletOptions } from "@/lib/wallet/store";
import { useTranslation } from "@/lib/i18n/react";
import { motion } from "framer-motion";

interface WalletConnectionModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function WalletConnectionModal({ open, onClose, title, description }: WalletConnectionModalProps) {
  const { t } = useTranslation("common");
  const { connect, connected, loading, error, clearError } = useWalletStore();

  const handleConnect = async (provider: WalletProvider) => {
    await connect(provider);
  };

  const handleSocialLogin = () => {
    window.location.href = "/api/auth/login";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#050505] border border-gray-200 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
            <div className="p-2 bg-neo/10 rounded-full text-neo">
              <Wallet size={20} />
            </div>
            {title || t("wallet.connectRequired")}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {description || t("wallet.connectDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-2 space-y-6">
          {/* Wallet Options */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t("wallet.selectWallet")}
            </p>
            <div className="grid gap-3">
              {walletOptions.map((wallet, idx) => (
                <motion.button
                  key={wallet.id}
                  onClick={() => handleConnect(wallet.id)}
                  disabled={loading}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 dark:border-white/10 px-4 py-3.5 text-left bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200 shadow-sm hover:shadow-md group"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 p-1 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <img
                      src={wallet.icon}
                      alt={wallet.name}
                      className="w-full h-full object-contain"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        e.currentTarget.src = "/wallet-default.svg";
                      }}
                    />
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white group-hover:text-neo transition-colors">{wallet.name}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Divider - only show if wallet not connected */}
          {!connected && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-100 dark:border-white/5" />
              </div>
              <div className="relative flex justify-center text-xs font-medium uppercase tracking-widest">
                <span className="bg-white dark:bg-[#050505] px-2 text-gray-400">{t("common.or")}</span>
              </div>
            </div>
          )}

          {/* Social Login - disabled when wallet is connected */}
          <Button
            onClick={handleSocialLogin}
            variant="outline"
            className={`w-full flex items-center justify-center gap-2 rounded-xl h-12 border transition-all duration-300 ${connected
              ? "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600 cursor-not-allowed"
              : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 hover:text-neo dark:hover:text-neo shadow-sm hover:shadow-md"
              }`}
            disabled={loading || connected}
          >
            <User size={18} />
            <span className="font-bold text-sm tracking-wide uppercase">
              {connected ? t("wallet.socialDisabledWhenConnected") : t("wallet.loginWithSocial")}
            </span>
            {!connected && <ExternalLink size={14} className="ml-auto opacity-50" />}
          </Button>

          {/* Error Display */}
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-900/10 p-3 flex items-start gap-3">
              <div className="text-red-500 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-current" /></div>
              <div className="flex-1">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium leading-tight">{error}</p>
                <button
                  onClick={clearError}
                  className="mt-1.5 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-300 font-bold uppercase tracking-wide"
                >
                  {t("actions.dismiss")}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50/50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5 flex justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            className="hover:bg-gray-200/50 dark:hover:bg-white/10 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium"
          >
            {t("actions.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
