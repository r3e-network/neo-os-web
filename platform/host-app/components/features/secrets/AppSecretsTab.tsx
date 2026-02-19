import { useEffect, useState } from "react";
import { Key, Lock, FileText } from "lucide-react";
import { useSecretsStore, SecretToken } from "@/lib/secrets";
import { cn } from "@/lib/utils";
import { useWalletStore } from "@/lib/wallet/store";
import { CreateTokenForm } from "./CreateTokenForm";

interface AppSecretsTabProps {
  appId: string;
  appName: string;
}

export function AppSecretsTab({ appId, appName }: AppSecretsTabProps) {
  const { connected } = useWalletStore();
  const { tokens, loading, fetchTokens, revokeToken } = useSecretsStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (connected) {
      fetchTokens(appId);
    }
  }, [connected, appId, fetchTokens]);

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
          className="px-4 py-2 bg-neo dark:bg-neo text-gray-900 dark:text-gray-900 font-medium rounded-md hover:bg-neo/90 dark:hover:bg-neo/90 transition-colors"
          onClick={() => setShowCreate(true)}
        >
          + Add Secret
        </button>
      </div>

      {showCreate && <CreateTokenForm onClose={() => setShowCreate(false)} defaultAppId={appId} />}

      {loading && <p className="text-center text-gray-500 dark:text-gray-400 py-6">Loading...</p>}

      {!loading && appTokens.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 py-6">No secrets configured for this app</p>}

      {appTokens.length > 0 && (
        <div className="flex flex-col gap-3">
          {appTokens.map((token) => (
            <SecretItem key={token.id} token={token} onRevoke={revokeToken} />
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-300">
        <p>Secrets are encrypted and stored securely for TEE confidential computing.</p>
      </div>
    </div>
  );
}

function SecretItem({ token, onRevoke }: { token: SecretToken; onRevoke: (id: string) => void }) {
  const typeIcons: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
    api_key: Key,
    encryption_key: Lock,
    custom: FileText,
  };
  const Icon = typeIcons[token.secretType] || FileText;

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-3">
        <Icon size={20} className="text-gray-500 dark:text-gray-400" />
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{token.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {token.appId === "global" ? "Global" : token.appId} • {token.secretType}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded",
            token.status === "active"
              ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
              : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
          )}
        >
          {token.status}
        </span>
        {token.status === "active" && (
          <button
            className="px-2 py-1 text-xs border border-red-500 dark:border-red-400 text-red-500 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            onClick={() => onRevoke(token.id)}
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}
