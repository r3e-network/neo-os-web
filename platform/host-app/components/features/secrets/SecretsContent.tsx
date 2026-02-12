import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSecretsStore } from "@/lib/secrets";
import { useWalletStore } from "@/lib/wallet/store";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import { CreateTokenForm } from "./CreateTokenForm";
import { TokenList } from "./TokenList";
import { InfoCard } from "./InfoCard";

const CONFIDENTIAL_APPS = BUILTIN_APPS.filter((app) => app.permissions?.confidential);

export default function SecretsContent() {
  const { connected } = useWalletStore();
  const { tokens, loading, error, fetchTokens, revokeToken, clearError } = useSecretsStore();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string>("all");

  useEffect(() => {
    if (connected) {
      fetchTokens(selectedApp === "all" ? undefined : selectedApp);
    }
  }, [connected, selectedApp, fetchTokens]);

  const filteredTokens =
    selectedApp === "all" ? tokens : tokens.filter((t) => t.appId === selectedApp || t.appId === "global");

  if (!connected) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-erobo-ink-soft">Connect your wallet to manage secret tokens</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={clearError} className="mt-1 text-xs text-red-500 underline">
            Dismiss
          </button>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Secret Tokens</CardTitle>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            Create Token
          </Button>
        </CardHeader>
        <CardContent>
          {/* MiniApp Filter */}
          <div className="mb-4">
            <label className="block text-sm text-erobo-ink-soft mb-2">Filter by MiniApp</label>
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="all">All Apps</option>
              <option value="global">Global Secrets Only</option>
              {CONFIDENTIAL_APPS.map((app) => (
                <option key={app.app_id} value={app.app_id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>

          {showCreate && (
            <CreateTokenForm
              onClose={() => setShowCreate(false)}
              defaultAppId={selectedApp !== "all" ? selectedApp : undefined}
            />
          )}

          {loading && <p className="text-erobo-ink-soft">Loading...</p>}

          {!loading && filteredTokens.length === 0 && <p className="text-erobo-ink-soft py-4">No tokens created yet</p>}

          {filteredTokens.length > 0 && <TokenList tokens={filteredTokens} onRevoke={revokeToken} />}
        </CardContent>
      </Card>

      <InfoCard />
    </div>
  );
}
