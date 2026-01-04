import React from "react";
import type { AppProps } from "next/app";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { QueryProvider } from "@/lib/query";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/lib/i18n/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthWalletSync } from "@/components/auth/AuthWalletSync";
import "@/styles/globals.css";

// Check if Auth0 is configured (client-side safe check)
const isAuth0Configured = Boolean(process.env.NEXT_PUBLIC_AUTH0_ENABLED === "true");

// Conditional Auth wrapper
function AuthWrapper({ children }: { children: React.ReactNode }) {
  if (!isAuth0Configured) {
    return <>{children}</>;
  }
  return <UserProvider>{children}</UserProvider>;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <AuthWrapper>
        <I18nProvider>
          <QueryProvider>
            <ThemeProvider>
              <AuthWalletSync />
              <Component {...pageProps} />
            </ThemeProvider>
          </QueryProvider>
        </I18nProvider>
      </AuthWrapper>
    </ErrorBoundary>
  );
}
