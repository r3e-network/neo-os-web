/**
 * Wallet Connection Modal
 * Prompts user to connect wallet or login with social account
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, User, ExternalLink } from "lucide-react";
import { useWalletStore, walletOptions, WalletProvider } from "@/lib/wallet/store";
import { useTranslation } from "@/lib/i18n/react";

interface WalletConnectionModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function WalletConnectionModal({ open, onClose, title, description }: WalletConnectionModalProps) {
  const { t } = useTranslation("common");
  const { connect, loading, error, clearError } = useWalletStore();

  const handleConnect = async (provider: WalletProvider) => {
    await connect(provider);
  };

  const handleSocialLogin = () => {
    window.location.href = "/api/auth/login";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet size={20} className="text-[#00E599]" />
            {title || t("wallet.connectRequired")}
          </DialogTitle>
          <DialogDescription>{description || t("wallet.connectDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Wallet Options */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("wallet.selectWallet")}</p>
            {walletOptions.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => handleConnect(wallet.id)}
                disabled={loading}
                className="flex w-full items-center gap-3 rounded-lg border-2 border-black px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                <img
                  src={wallet.icon}
                  alt={wallet.name}
                  className="w-6 h-6 rounded"
                  onError={(e) => {
                    e.currentTarget.src = "/wallet-default.svg";
                  }}
                />
                <span className="font-bold">{wallet.name}</span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-gray-900 px-2 text-gray-500">{t("common.or")}</span>
            </div>
          </div>

          {/* Social Login */}
          <Button
            onClick={handleSocialLogin}
            variant="outline"
            className="w-full flex items-center gap-2"
            disabled={loading}
          >
            <User size={18} />
            {t("wallet.loginWithSocial")}
            <ExternalLink size={14} className="ml-auto opacity-50" />
          </Button>

          {/* Error Display */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
              <button onClick={clearError} className="mt-2 text-xs text-red-500 underline">
                {t("actions.dismiss")}
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
