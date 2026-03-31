import { useEffect, useState } from "react";
import { Key, Lock, FileText } from "lucide-react";
import { useSecretsStore, SecretToken } from "@/lib/secrets";
import { cn } from "@/lib/utils";
import { useWalletStore } from "@/lib/wallet/store";
import { ConfirmModal } from "@/components/ui/modal";
import { CreateTokenForm } from "./CreateTokenForm";

interface AppSecretsTabProps {
  appId: string;
  appName: string;
}

export function AppSecretsTab({ appId, appName }: AppSecretsTabProps) {
  const { connected } = useWalletStore();
  const { tokens, loading, fetchTokens, revokeToken, error, clearError } = useSecretsStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (connected) {
      clearError();
      fetchTokens(appId);
    }
  }, [connected, appId, fetchTokens, clearError]);

  const appTokens = tokens.filter((t) => t.appId === appId || t.appId === "global");

  if (!connected) {
    return (
      <div className="py-4">
        <p className="text-center text-gray-500 dark:text-gray-400 py-6">Connect wallet to manage secrets for {appName}</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Secrets for {appName}</h3>
        <button
          type="button"
          className="px-4 py-2 bg-neo dark:bg-neo text-gray-900 dark:text-gray-900 font-medium rounded-md hover:bg-neo/90 dark:hover:bg-neo/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          onClick={() => setShowCreate(true)}
        >
          + Add Secret
        </button>
      </div>

      {showCreate && <CreateTokenForm onClose={() => setShowCreate(false)} defaultAppId={appId} />}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
        </div>
      )}
      {loading && <p className="text-center text-gray-500 dark:text-gray-400 py-6">Loading...</p>}

      {!loading && !error && appTokens.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 py-6">No secrets configured for this app</p>}

      {appTokens.length > 0 && (
        <ul className="flex flex-col gap-3">
          {appTokens.map((token) => (
            <SecretItem key={token.id} token={token} onRevoke={revokeToken} />
          ))}
        </ul>
      )}

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-300">
        <p>Secrets are encrypted and stored securely for TEE confidential computing.</p>
      </div>
    </div>
  );
}

function SecretItem({ token, onRevoke }: { token: SecretToken; onRevoke: (id: string) => void }) {
  const [revoking, setRevoking] = useState(false);
  const [revokeErr, setRevokeErr] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const typeIcons: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
    api_key: Key,
    encryption_key: Lock,
    custom: FileText,
  };
  const Icon = typeIcons[token.secretType] || FileText;

  const handleRevoke = async () => {
    setRevoking(true);
    setRevokeErr(null);
    try {
      await onRevoke(token.id);
    } catch (err) {
      setRevokeErr(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <li className="flex flex-col gap-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Icon size={20} className="text-gray-500 dark:text-gray-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 dark:text-white truncate" title={token.name}>{token.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {token.appId === "global" ? "Global" : token.appId} • {token.secretType}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              token.status === "active"
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400"
                : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
            )}
          >
            {token.status}
          </span>
          {token.status === "active" && (
            <button
              type="button"
              disabled={revoking}
              className="px-2 py-1 text-xs border border-red-500 dark:border-red-400 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
              onClick={() => setShowConfirm(true)}
            >
              {revoking ? "Revoking..." : "Revoke"}
            </button>
          )}
        </div>
      </div>
      {revokeErr && (
        <p className="text-xs text-red-600 dark:text-red-400">{revokeErr}</p>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Delete Secret"
        message="This secret will be permanently deleted. This action cannot be undone."
        confirmText="Delete Secret"
        confirmVariant="danger"
        onConfirm={handleRevoke}
        onCancel={() => setShowConfirm(false)}
      />
    </li>
  );
}
