import React from "react";
import type { AppProps } from "next/app";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { QueryProvider } from "@/lib/query";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/lib/i18n/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthWalletSync } from "@/components/auth/AuthWalletSync";
import { WalletDialogProvider } from "@/components/providers/WalletDialogProvider";
import { WalletAutoReconnect } from "@/components/auth/WalletAutoReconnect";
import "@/styles/globals.css";

import { useScrollRestoration } from "@/hooks/useScrollRestoration";

export default function App({ Component, pageProps, router }: AppProps) {
  useScrollRestoration(router);

  return (
    <ErrorBoundary>
      <UserProvider>
        <I18nProvider>
          <QueryProvider>
            <ThemeProvider>
              <WalletDialogProvider>
                <AuthWalletSync />
                <WalletAutoReconnect />
                <Component {...pageProps} />
              </WalletDialogProvider>
            </ThemeProvider>
          </QueryProvider>
        </I18nProvider>
      </UserProvider>
    </ErrorBoundary>
  );
}
