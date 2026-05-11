import { useAuthStore } from "@/lib/auth/store";
import { WalletProvider, walletOptions } from "@/lib/wallet/store";
import { cn } from "@/lib/utils";
import { interpolate } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/react";
import Head from "next/head";

const socialProviders = [
  {
    id: "google",
    name: "Google",
    bg: "bg-white border border-gray-300 hover:bg-gray-50 transition-colors",
    text: "text-gray-800",
  },
  {
    id: "twitter",
    name: "Twitter",
    bg: "bg-sky-500 hover:bg-sky-600 transition-colors",
    text: "text-white",
  },
  {
    id: "github",
    name: "GitHub",
    bg: "bg-gray-900 hover:bg-gray-800 transition-colors",
    text: "text-white",
  },
];

export default function LoginPage() {
  const { t } = useI18n();
  const { loginSocial, loginWallet, loading, error, clearError } =
    useAuthStore();

  return (
    <>
      <Head>
        <title>{t("auth.login")}</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-center text-2xl font-extrabold text-gray-900">
            {t("auth.login")}
          </h1>

          <div className="space-y-3">
            {socialProviders.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => loginSocial(p.id)}
                disabled={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${p.bg} ${p.text}`}
              >
                {interpolate(t("auth.continueWith"), { provider: p.name })}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-500">
              {t("auth.orConnectWallet")}
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="space-y-2">
            {walletOptions.map((w) => (
              <button
                type="button"
                key={w.id}
                onClick={() => loginWallet(w.id as WalletProvider)}
                disabled={loading}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:border-neo hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gray-100 bg-gray-50">
                  <img
                    src={w.icon}
                    alt={t(`walletOptions.${w.id}.name`)}
                    width={28}
                    height={28}
                    className="max-h-7 max-w-7 object-contain"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-bold text-gray-800">
                      {t(`walletOptions.${w.id}.name`)}
                    </span>
                    {w.recommended && (
                      <span className="rounded-full bg-neo/10 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                        {t("auth.recommended")}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium leading-snug text-gray-500">
                    {t(`walletOptions.${w.id}.description`)}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                    w.protocol === "NEP-21"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-500",
                  )}
                >
                  {w.protocol === "NEP-21"
                    ? t("walletOptions.protocol.nep21")
                    : t("walletOptions.protocol.legacyDapi")}
                </span>
              </button>
            ))}
          </div>

          {loading && (
            <p className="text-center text-sm text-gray-500">
              {t("auth.connecting")}
            </p>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600"
            >
              {error}
              <button
                type="button"
                onClick={clearError}
                className="ml-2 underline transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg"
              >
                {t("auth.dismiss")}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
