import React from "react";
import type { AppProps } from "next/app";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { QueryProvider } from "@/lib/query";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/lib/i18n/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <UserProvider>
        <I18nProvider>
          <QueryProvider>
            <ThemeProvider>
              <Component {...pageProps} />
            </ThemeProvider>
          </QueryProvider>
        </I18nProvider>
      </UserProvider>
    </ErrorBoundary>
  );
}
