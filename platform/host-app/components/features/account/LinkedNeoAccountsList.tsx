import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Trash2, Plus, Copy, Check, Star } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";
import { PasswordVerificationModal } from "./PasswordVerificationModal";
import type { LinkedNeoAccount } from "@/lib/neohub-account";

interface LinkedNeoAccountsListProps {
  accounts: LinkedNeoAccount[];
  canUnlink: boolean;
  onUnlink: (accountId: string, password: string) => Promise<boolean>;
  onAddNew?: () => void;
}

export function LinkedNeoAccountsList({ accounts, canUnlink, onUnlink, onAddNew }: LinkedNeoAccountsListProps) {
  const { t } = useTranslation("host");
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleUnlinkConfirm = async (password: string) => {
    if (!unlinkingId) return false;
    const success = await onUnlink(unlinkingId, password);
    if (success) setUnlinkingId(null);
    return success;
  };

  const copyAddress = (id: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  if (accounts.length === 0) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t("account.neohub.noNeoAccounts")}</div>;
  }

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <div
          key={account.id}
          className="flex items-center justify-between p-4 border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-neo/10 text-neo">
              <Wallet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">{truncateAddress(account.address)}</span>
                {account.isPrimary && (
                  <Badge className="bg-neo/20 hover:bg-neo/30 text-neo border-0 text-[10px] px-1.5 h-5">
                    <Star size={10} className="mr-1 fill-neo" />
                    {t("account.neohub.primary")}
                  </Badge>
                )}
              </div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                Linked on {new Date(account.linkedAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyAddress(account.id, account.address)}
              className="text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors"
              title="Copy address"
            >
              {copiedId === account.id ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </Button>

            {canUnlink && accounts.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUnlinkingId(account.id)}
                className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                title="Unlink wallet"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
      ))}

      {onAddNew && (
        <Button variant="outline" onClick={onAddNew} className="w-full mt-4 border-dashed border-gray-300 dark:border-white/20 hover:border-neo hover:text-neo dark:hover:text-neo hover:bg-neo/5">
          <Plus size={16} className="mr-2" />
          {t("account.neohub.linkNew")}
        </Button>
      )}

      <PasswordVerificationModal
        isOpen={!!unlinkingId}
        onClose={() => setUnlinkingId(null)}
        onVerify={handleUnlinkConfirm}
        description={t("account.neohub.unlinkConfirm")}
      />
    </div>
  );
}
