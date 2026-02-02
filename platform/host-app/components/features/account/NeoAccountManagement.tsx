/**
 * Neo Account Management Component
 *
 * This component is now a placeholder for wallet-based account management.
 * Wallet-based authentication does not support the same management features
 * as social authentication (password change, WIF import/export, etc.).
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

interface NeoAccountManagementProps {
  walletAddress?: string;
}

/**
 * @deprecated This component is for social account management only.
 * For wallet-based authentication, account management is handled by the wallet provider.
 */
export function NeoAccountManagement({ walletAddress }: NeoAccountManagementProps) {
  const { t } = useTranslation("host");

  return (
    <Card className="rounded-2xl bg-white/50 dark:bg-black/40 backdrop-blur-sm border-gray-200 dark:border-white/10 shadow-sm">
      <CardHeader className="border-b border-gray-100 dark:border-white/5 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Wallet className="text-neo mr-2" size={28} />
              {t("account.neo.title") || "Neo Account"}
            </CardTitle>
            <CardDescription className="mt-1 text-gray-500 dark:text-gray-400">
              {t("account.neo.walletModeSubtitle") || "Your account is managed by your connected wallet"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-8 space-y-6">
        {/* Current Address Display */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                {t("account.neo.currentAddress") || "Current Address"}
              </p>
              <p className="text-sm font-mono font-medium text-gray-900 dark:text-white truncate">
                {walletAddress || "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Info Message */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            {t("account.neo.walletModeInfo") ||
              "Account management features (regenerate, import, export) are not available in wallet mode. Please use your wallet provider to manage your account."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default NeoAccountManagement;
