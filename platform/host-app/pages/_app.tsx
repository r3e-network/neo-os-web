import React from "react";
import type { AppProps } from "next/app";
import { QueryProvider } from "@/lib/query";
import { TRPCProvider } from "@/components/providers/TRPCProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/lib/i18n/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WalletDialogProvider } from "@/components/providers/WalletDialogProvider";
import { WalletAutoReconnect } from "@/components/auth/WalletAutoReconnect";
import "@/styles/globals.css";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";

export default function App({ Component, pageProps, router }: AppProps) {
  useScrollRestoration(router);
  return (
    <ErrorBoundary>
      <I18nProvider>
        <QueryProvider>
          <TRPCProvider>
            <ThemeProvider>
              <WalletDialogProvider>
                <WalletAutoReconnect />
                <Component {...pageProps} />
              </WalletDialogProvider>
            </ThemeProvider>
          </TRPCProvider>
        </QueryProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
