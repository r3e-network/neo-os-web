import { Badge } from "@/components/ui/badge";
import type { SecretToken } from "@/lib/secrets";
import { useTranslation } from "@/lib/i18n/react";

interface TokenListProps {
  tokens: SecretToken[];
  onRevoke: (id: string) => void;
}

export function TokenList({ tokens, onRevoke }: TokenListProps) {
  const { t, locale } = useTranslation("host");
  return (
    <div className="space-y-3">
      {tokens.map((token) => (
        <div key={token.id} className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{token.name}</span>
              <StatusBadge status={token.status} label={t(`secrets.status.${token.status}`)} />
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {t("secrets.app")}: {token.appName || token.appId}
            </div>
            <div className="text-xs text-gray-400">
              {t("secrets.created")}: {formatDate(token.createdAt, locale)}
              {token.lastUsed && ` • ${t("secrets.lastUsed")}: ${formatDate(token.lastUsed, locale)}`}
            </div>
          </div>

          {token.status === "active" && (
            <button onClick={() => onRevoke(token.id)} className="text-sm text-red-600 hover:underline">
              {t("secrets.revoke")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status, label }: { status: SecretToken["status"]; label: string }) {
  const variants: Record<SecretToken["status"], "default" | "secondary" | "destructive"> = {
    active: "default",
    expired: "secondary",
    revoked: "destructive",
  };

  return <Badge variant={variants[status]}>{label}</Badge>;
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale);
}
