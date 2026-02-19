import { type ReactNode, useEffect } from "react";
import type { AppProps } from "next/app";
import { UserProvider, useUser } from "@auth0/nextjs-auth0/client";
import { QueryProvider } from "@/lib/query";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/lib/i18n/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuthStore } from "@/lib/auth/store";
import "@/styles/globals.css";

function AuthSync({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const syncFromSession = useAuthStore((s) => s.syncFromSession);
  useEffect(() => { syncFromSession(user ?? null); }, [user, syncFromSession]);
  return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <UserProvider>
        <AuthSync>
          <I18nProvider>
            <QueryProvider>
              <ThemeProvider>
                <Component {...pageProps} />
              </ThemeProvider>
            </QueryProvider>
          </I18nProvider>
        </AuthSync>
      </UserProvider>
    </ErrorBoundary>
  );
}
