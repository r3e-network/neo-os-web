import { Badge } from "@/components/ui/badge";
import { SecretToken } from "@/lib/secrets";

interface TokenListProps {
  tokens: SecretToken[];
  onRevoke: (id: string) => void;
}

export function TokenList({ tokens, onRevoke }: TokenListProps) {
  return (
    <div className="space-y-3">
      {tokens.map((token) => (
        <div key={token.id} className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{token.name}</span>
              <StatusBadge status={token.status} />
            </div>
            <div className="mt-1 text-sm text-gray-500">App: {token.appName || token.appId}</div>
            <div className="text-xs text-gray-400">
              Created: {formatDate(token.createdAt)}
              {token.lastUsed && ` • Last used: ${formatDate(token.lastUsed)}`}
            </div>
          </div>

          {token.status === "active" && (
            <button onClick={() => onRevoke(token.id)} className="text-sm text-red-600 hover:underline">
              Revoke
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: SecretToken["status"] }) {
  const variants: Record<SecretToken["status"], "default" | "secondary" | "destructive"> = {
    active: "default",
    expired: "secondary",
    revoked: "destructive",
  };

  return <Badge variant={variants[status]}>{status}</Badge>;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}
