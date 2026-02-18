import { useAuthStore } from "@/lib/auth/store";
import { WalletProvider, walletOptions } from "@/lib/wallet/store";
import Head from "next/head";

const socialProviders = [
  { id: "google", name: "Google", bg: "bg-white border hover:bg-gray-50", text: "text-gray-800" },
  { id: "twitter", name: "Twitter", bg: "bg-sky-500 hover:bg-sky-600", text: "text-white" },
  { id: "github", name: "GitHub", bg: "bg-gray-900 hover:bg-gray-800", text: "text-white" },
];

export default function LoginPage() {
  const { loginSocial, loginWallet, loading, error, clearError } = useAuthStore();

  return (
    <>
      <Head><title>Log In</title></Head>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-center text-2xl font-bold text-gray-900">Log in</h1>

          <div className="space-y-3">
            {socialProviders.map((p) => (
              <button
                key={p.id}
                onClick={() => loginSocial(p.id)}
                disabled={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-colors ${p.bg} ${p.text}`}
              >
                Continue with {p.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">or connect wallet</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="space-y-2">
            {walletOptions.map((w) => (
              <button
                key={w.id}
                onClick={() => loginWallet(w.id as WalletProvider)}
                disabled={loading}
                className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <img src={w.icon} alt={w.name} className="h-5 w-5 rounded" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                {w.name}
              </button>
            ))}
          </div>

          {loading && <p className="text-center text-sm text-gray-500">Connecting...</p>}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
              <button onClick={clearError} className="ml-2 underline">dismiss</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
