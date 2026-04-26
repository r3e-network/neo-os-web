import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecretsStore } from "@/lib/secrets";
import { useWalletStore } from "@/lib/wallet/store";
import { CreateTokenForm } from "./CreateTokenForm";
import { TokenList } from "./TokenList";
import { InfoCard } from "./InfoCard";

export default function SecretsContent() {
  const { connected } = useWalletStore();
  const { tokens, loading, error, fetchTokens, revokeToken, clearError } =
    useSecretsStore();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string>("all");

  const appScopes = Array.from(
    new Set(
      tokens
        .map((token) => token.appId)
        .filter((appId) => appId && appId !== "global"),
    ),
  ).sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    if (connected) {
      fetchTokens(selectedApp === "all" ? undefined : selectedApp);
    }
  }, [connected, selectedApp, fetchTokens]);

  const filteredTokens =
    selectedApp === "all"
      ? tokens
      : tokens.filter((t) => t.appId === selectedApp || t.appId === "global");

  if (!connected) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">
            Connect your wallet to manage secret tokens
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3"
        >
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={clearError}
            className="mt-1 py-1 px-2 text-xs text-red-500 underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg"
          >
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
            <label
              htmlFor="secrets-app-filter"
              className="block text-sm text-gray-600 mb-2"
            >
              Filter by MiniApp
            </label>
            <select
              id="secrets-app-filter"
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white text-gray-900 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
            >
              <option value="all">All Apps</option>
              <option value="global">Global Secrets Only</option>
              {appScopes.map((appId) => (
                <option key={appId} value={appId}>
                  {appId}
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

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-6 w-14" />
                </div>
              ))}
            </div>
          )}

          {!loading && filteredTokens.length === 0 && (
            <p className="text-gray-500 py-4">No tokens created yet</p>
          )}

          {filteredTokens.length > 0 && (
            <TokenList tokens={filteredTokens} onRevoke={revokeToken} />
          )}
        </CardContent>
      </Card>

      <InfoCard />
    </div>
  );
}
