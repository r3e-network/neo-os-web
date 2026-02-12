import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Wallet } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";
import { useTranslation } from "@/lib/i18n/react";
import { LinkedIdentitiesList } from "./LinkedIdentitiesList";
import { LinkedNeoAccountsList } from "./LinkedNeoAccountsList";
import type { LinkedIdentity, LinkedChainAccount } from "@/lib/neohub-account";
import { logger } from "@/lib/logger";

interface NeoHubAccountData {
  neohubAccountId: string;
  linkedIdentities: LinkedIdentity[];
  linkedNeoAccounts: LinkedChainAccount[];
}

/**
 * @deprecated This component is for social account management only.
 * For wallet-based authentication, the connected wallet serves as the primary account.
 */
export function NeoHubAccountPanel() {
  const { t } = useTranslation("host");
  const { connected, address } = useWalletStore();
  const [accountData, setAccountData] = useState<NeoHubAccountData | null>(null);
  const [_loading, setLoading] = useState(true);

  // Fetch account data
  useEffect(() => {
    if (!connected) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch("/api/account/status");
        const data = await res.json();
        if (data.hasAccount) {
          setAccountData({
            neohubAccountId: data.neohubAccountId,
            linkedIdentities: data.linkedIdentities || [],
            linkedNeoAccounts: data.linkedNeoAccounts || [],
          });
        }
      } catch (err) {
        logger.error("Failed to fetch account data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [connected]);

  // Unlink identity handler - not supported in wallet mode
  const handleUnlinkIdentity = async (_identityId: string, _password: string) => {
    return false;
  };

  // Unlink Neo account handler - not supported in wallet mode
  const handleUnlinkNeo = async (_neoAccountId: string, _password: string) => {
    return false;
  };

  // Show wallet connection info instead of social account info
  if (!connected) return null;

  return (
    <Card className="erobo-card">
      <CardHeader className="border-b border-erobo-purple/5 dark:border-white/5 pb-6">
        <CardTitle className="text-2xl font-bold tracking-tight text-erobo-ink dark:text-white flex items-center gap-2">
          <Users size={28} className="text-neo" />
          {t("account.wallet.title") || "Connected Wallet"}
        </CardTitle>
        <CardDescription className="mt-1 text-erobo-ink-soft dark:text-slate-400">
          {t("account.wallet.subtitle") || "Your wallet connection details"}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-8">
        {/* Current Wallet Address */}
        <div className="p-4 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} className="text-erobo-ink-soft/60" />
            <span className="text-xs font-bold uppercase tracking-wide text-erobo-ink-soft dark:text-slate-400">
              {t("account.wallet.address") || "Wallet Address"}
            </span>
          </div>
          <p className="text-sm font-mono font-medium text-erobo-ink dark:text-white break-all">{address}</p>
        </div>

        {/* Linked accounts sections - only show if account data exists */}
        {accountData && (
          <>
            {/* Linked Social Accounts */}
            <div>
              <h3 className="font-bold text-sm text-erobo-ink dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
                <Users size={16} className="text-erobo-ink-soft/60" />
                {t("account.neohub.linkedIdentities")}
              </h3>
              <LinkedIdentitiesList
                identities={accountData.linkedIdentities}
                canUnlink={false}
                onUnlink={handleUnlinkIdentity}
              />
            </div>

            {/* Linked Neo Wallets */}
            <div>
              <h3 className="font-bold text-sm text-erobo-ink dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
                <Wallet size={16} className="text-erobo-ink-soft/60" />
                {t("account.neohub.linkedNeoAccounts")}
              </h3>
              <LinkedNeoAccountsList
                accounts={accountData.linkedNeoAccounts}
                canUnlink={false}
                onUnlink={handleUnlinkNeo}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
