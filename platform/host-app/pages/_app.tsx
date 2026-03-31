import { type ReactNode, useEffect } from "react";
import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { UserProvider, useUser } from "@auth0/nextjs-auth0/client";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { QueryProvider } from "@/lib/query";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/lib/i18n/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { useAuthStore } from "@/lib/auth/store";
import { Inter, Outfit } from "next/font/google";
import "@/styles/globals.css";

// Lazy-load dev-only monitoring panels (excluded from production bundle)
const MonitoringPanel = dynamic(
  () => import("@/components/MonitoringPanel").then((m) => ({ default: m.MonitoringPanel })),
  { ssr: false },
);
const PerformanceReportPanel = dynamic(
  () => import("@/components/PerformanceReport").then((m) => ({ default: m.PerformanceReportPanel })),
  { ssr: false },
);

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

function AuthSync({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const syncFromSession = useAuthStore((s) => s.syncFromSession);
  useEffect(() => { syncFromSession(user ?? null); }, [user, syncFromSession]);
  return <>{children}</>;
}

/**
 * Initialize monitoring after hydration via dynamic import
 * to keep it out of the critical JS bundle.
 */
function MonitoringInit() {
  useEffect(() => {
    import("@/lib/monitoring").then(({ initAllMonitoring }) => {
      initAllMonitoring();
    });
  }, []);

  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <div className={`${inter.variable} ${outfit.variable} font-sans`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded"
      >
        Skip to main content
      </a>
      <ErrorBoundary>
        <MotionConfig reducedMotion="user">
          <UserProvider>
            <AuthSync>
              <I18nProvider>
                <QueryProvider>
                  <ThemeProvider>
                    <AnalyticsProvider>
                      <MonitoringInit />
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.main
                          key={router.asPath}
                          id="main-content"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                        >
                          <Component {...pageProps} />
                        </motion.main>
                      </AnimatePresence>

                      {/* Development monitoring panels */}
                      {process.env.NODE_ENV === "development" && (
                        <>
                          <PerformanceReportPanel
                            devOnly={true}
                            position="bottom-right"
                          />
                          <MonitoringPanel
                            position="bottom-right"
                          />
                        </>
                      )}
                    </AnalyticsProvider>
                  </ThemeProvider>
                </QueryProvider>
              </I18nProvider>
            </AuthSync>
          </UserProvider>
        </MotionConfig>
      </ErrorBoundary>
    </div>
  );
}
