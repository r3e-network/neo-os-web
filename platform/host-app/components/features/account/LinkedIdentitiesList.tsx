import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Github, Twitter, Chrome, Trash2, Plus, Clock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";
import { PasswordVerificationModal } from "./PasswordVerificationModal";
import type { LinkedIdentity } from "@/lib/neohub-account";

interface LinkedIdentitiesListProps {
  identities: LinkedIdentity[];
  canUnlink: boolean;
  onUnlink: (identityId: string, password: string) => Promise<boolean>;
  onLinkNew?: () => void;
}

const providerIcons: Record<string, React.ReactNode> = {
  "google-oauth2": <Chrome size={20} className="text-red-500" />,
  twitter: <Twitter size={20} className="text-blue-400" />,
  github: <Github size={20} />,
};

const providerNames: Record<string, string> = {
  "google-oauth2": "Google",
  twitter: "Twitter",
  github: "GitHub",
};

export function LinkedIdentitiesList({ identities, canUnlink, onUnlink, onLinkNew }: LinkedIdentitiesListProps) {
  const { t, locale } = useTranslation("host");
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const handleUnlinkConfirm = async (password: string) => {
    if (!unlinkingId) return false;
    const success = await onUnlink(unlinkingId, password);
    if (success) setUnlinkingId(null);
    return success;
  };

  if (identities.length === 0) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t("account.neohub.noIdentities")}</div>;
  }

  return (
    <div className="space-y-4">
      {identities.map((identity) => (
        <div
          key={identity.id}
          className="flex items-center justify-between p-4 border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 dark:bg-white/10 text-gray-700 dark:text-gray-300">
              {providerIcons[identity.provider] || <Chrome size={20} />}
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900 dark:text-white">{providerNames[identity.provider] || identity.provider}</div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                {identity.email || identity.name || identity.providerUserId}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {identity.lastUsedAt && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
                <Clock size={12} />
                {new Date(identity.lastUsedAt).toLocaleDateString(locale)}
              </div>
            )}

            {canUnlink && identities.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUnlinkingId(identity.id)}
                className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                title="Unlink account"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
      ))}

      {onLinkNew && (
        <Button variant="outline" onClick={onLinkNew} className="w-full mt-4 border-dashed border-gray-300 dark:border-white/20 hover:border-neo hover:text-neo dark:hover:text-neo hover:bg-neo/5">
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
