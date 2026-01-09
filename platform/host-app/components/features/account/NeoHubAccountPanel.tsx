import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Wallet } from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useTranslation } from "@/lib/i18n/react";
import { LinkedIdentitiesList } from "./LinkedIdentitiesList";
import { LinkedNeoAccountsList } from "./LinkedNeoAccountsList";
import type { LinkedIdentity, LinkedNeoAccount } from "@/lib/neohub-account";

interface NeoHubAccountData {
  neohubAccountId: string;
  linkedIdentities: LinkedIdentity[];
  linkedNeoAccounts: LinkedNeoAccount[];
}

export function NeoHubAccountPanel() {
  const { t } = useTranslation("host");
  const { user } = useUser();
  const [accountData, setAccountData] = useState<NeoHubAccountData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch account data
  useEffect(() => {
    if (!user) return;

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
        console.error("Failed to fetch account data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Unlink identity handler
  const handleUnlinkIdentity = async (identityId: string, password: string) => {
    const res = await fetch("/api/account/unlink-identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identityId, password }),
    });

    if (res.ok) {
      setAccountData((prev) =>
        prev
          ? {
            ...prev,
            linkedIdentities: prev.linkedIdentities.filter((i) => i.id !== identityId),
          }
          : null,
      );
      return true;
    }
    return false;
  };

  // Unlink Neo account handler
  const handleUnlinkNeo = async (neoAccountId: string, password: string) => {
    const res = await fetch("/api/account/unlink-neo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neoAccountId, password }),
    });

    if (res.ok) {
      setAccountData((prev) =>
        prev
          ? {
            ...prev,
            linkedNeoAccounts: prev.linkedNeoAccounts.filter((n) => n.id !== neoAccountId),
          }
          : null,
      );
      return true;
    }
    return false;
  };

  if (!user || loading) return null;
  if (!accountData) return null;

  const totalAccounts = accountData.linkedIdentities.length + accountData.linkedNeoAccounts.length;
  const canUnlink = totalAccounts > 1;

  return (
    <Card className="erobo-card">
      <CardHeader className="border-b border-gray-100 dark:border-white/5 pb-6">
        <CardTitle className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <Users size={28} className="text-neo" />
          {t("account.neohub.title")}
        </CardTitle>
        <CardDescription className="mt-1 text-gray-500 dark:text-gray-400">
          {t("account.neohub.subtitle")}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-8">
        {/* Linked Social Accounts */}
        <div>
          <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
            <Users size={16} className="text-gray-400" />
            {t("account.neohub.linkedIdentities")}
          </h3>
          <LinkedIdentitiesList
            identities={accountData.linkedIdentities}
            canUnlink={canUnlink}
            onUnlink={handleUnlinkIdentity}
          />
        </div>

        {/* Linked Neo Wallets */}
        <div>
          <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
            <Wallet size={16} className="text-gray-400" />
            {t("account.neohub.linkedNeoAccounts")}
          </h3>
          <LinkedNeoAccountsList
            accounts={accountData.linkedNeoAccounts}
            canUnlink={canUnlink}
            onUnlink={handleUnlinkNeo}
          />
        </div>
      </CardContent>
    </Card>
  );
}
