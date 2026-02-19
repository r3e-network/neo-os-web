import { useOAuthStore, oauthProviders, OAuthProvider } from "@/lib/oauth";

export function OAuthLinks() {
  const { accounts, loading, error, linkAccount, unlinkAccount, clearError } = useOAuthStore();

  const isLinked = (provider: OAuthProvider) => accounts.some((a) => a.provider === provider);

  const getAccount = (provider: OAuthProvider) => accounts.find((a) => a.provider === provider);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Linked Accounts</h3>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button type="button" onClick={clearError} className="mt-1 text-xs text-red-500 dark:text-red-400 underline">
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
            <div key={provider.id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{provider.icon}</span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{provider.name}</div>
                  {linked && account && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{account.email || account.name || account.id}</div>
                  )}
                </div>
              </div>

              {linked ? (
                <button
                  type="button"
                  onClick={() => unlinkAccount(provider.id)}
                  className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Unlink
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => linkAccount(provider.id)}
                  disabled={isLoading}
                  className="rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-sm text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
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
