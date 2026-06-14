import { type ReactNode, useEffect } from "react";
import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { UserProvider, useUser } from "@auth0/nextjs-auth0/client";
import { QueryProvider } from "@/lib/query";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/lib/i18n/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { useAuthStore } from "@/lib/auth/store";
import "@/styles/globals.css";

// Lazy-load dev-only monitoring panels (excluded from production bundle)
const MonitoringPanel = dynamic(
  () =>
    import("@/components/MonitoringPanel").then((m) => ({
      default: m.MonitoringPanel,
    })),
  { ssr: false },
);
const PerformanceReportPanel = dynamic(
  () =>
    import("@/components/PerformanceReport").then((m) => ({
      default: m.PerformanceReportPanel,
    })),
  { ssr: false },
);

function AuthSync({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const syncFromSession = useAuthStore((s) => s.syncFromSession);
  useEffect(() => {
    syncFromSession(user ?? null);
  }, [user, syncFromSession]);
  return <>{children}</>;
}

/**
 * Initialize monitoring after hydration via dynamic import
 * to keep it out of the critical JS bundle.
 */
function MonitoringInit() {
  useEffect(() => {
    import("@/lib/monitoring")
      .then(({ initAllMonitoring }) => {
        initAllMonitoring();
      })
      .catch((e) => {
        console.warn(
          "[monitoring] failed to initialize:",
          e instanceof Error ? e.message : String(e),
        );
      });
  }, []);

  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <div className="font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[140] focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded"
      >
        Skip to main content
      </a>
      <ErrorBoundary>
        <UserProvider profileUrl="/api/auth/profile">
          <AuthSync>
            <I18nProvider>
              <QueryProvider>
                <ThemeProvider>
                  <AnalyticsProvider>
                    <MonitoringInit />
                    {/* CSS-only route enter transition (was framer-motion).
                        `key={router.asPath}` remounts on navigation so the
                        `page-enter` keyframe replays; the global
                        prefers-reduced-motion rule collapses it for opt-outs.
                        This keeps framer-motion out of the shared first-load
                        bundle — route-scoped usage (developer page) loads it in
                        its own page chunk. */}
                    <main
                      key={router.asPath}
                      id="main-content"
                      className="page-transition"
                    >
                      <Component {...pageProps} />
                    </main>

                    {/* Development monitoring panels */}
                    {process.env.NODE_ENV === "development" && (
                      <>
                        <PerformanceReportPanel
                          devOnly={true}
                          position="bottom-right"
                        />
                        <MonitoringPanel position="bottom-right" />
                      </>
                    )}
                  </AnalyticsProvider>
                </ThemeProvider>
              </QueryProvider>
            </I18nProvider>
          </AuthSync>
        </UserProvider>
      </ErrorBoundary>
    </div>
  );
}
