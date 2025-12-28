import { useOAuthStore, oauthProviders, OAuthProvider } from "@/lib/oauth";

export function OAuthLinks() {
  const { accounts, loading, error, linkAccount, unlinkAccount, clearError } = useOAuthStore();

  const isLinked = (provider: OAuthProvider) => accounts.some((a) => a.provider === provider);

  const getAccount = (provider: OAuthProvider) => accounts.find((a) => a.provider === provider);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Linked Accounts</h3>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={clearError} className="mt-1 text-xs text-red-500 underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-2">
        {oauthProviders.map((provider) => {
          const linked = isLinked(provider.id);
          const account = getAccount(provider.id);
          const isLoading = loading === provider.id;

          return (
            <div key={provider.id} className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{provider.icon}</span>
                <div>
                  <div className="font-medium">{provider.name}</div>
                  {linked && account && (
                    <div className="text-sm text-gray-500">{account.email || account.name || account.id}</div>
                  )}
                </div>
              </div>

              {linked ? (
                <button
                  onClick={() => unlinkAccount(provider.id)}
                  className="rounded-md border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Unlink
                </button>
              ) : (
                <button
                  onClick={() => linkAccount(provider.id)}
                  disabled={isLoading}
                  className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {isLoading ? "Linking..." : "Link"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
