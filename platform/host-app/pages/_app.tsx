import { type ReactNode, useEffect } from "react";
import type { AppProps } from "next/app";
import { UserProvider, useUser } from "@auth0/nextjs-auth0/client";
import { MotionConfig } from "framer-motion";
import { QueryProvider } from "@/lib/query";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/lib/i18n/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { MonitoringPanel } from "@/components/MonitoringPanel";
import { PerformanceReportPanel } from "@/components/PerformanceReport";
import { useAuthStore } from "@/lib/auth/store";
import { initAllMonitoring } from "@/lib/monitoring";
import { Inter, Outfit } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

function AuthSync({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const syncFromSession = useAuthStore((s) => s.syncFromSession);
  useEffect(() => { syncFromSession(user ?? null); }, [user, syncFromSession]);
  return <>{children}</>;
}

/**
 * Initialize monitoring on app mount
 */
function MonitoringInit() {
  useEffect(() => {
    // Initialize all monitoring systems
    initAllMonitoring();
  }, []);

  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${inter.variable} ${outfit.variable} font-sans`}>
      <ErrorBoundary>
        <MotionConfig reducedMotion="user">
          <UserProvider>
            <AuthSync>
              <I18nProvider>
                <QueryProvider>
                  <ThemeProvider>
                    <AnalyticsProvider>
                      <MonitoringInit />
                      <Component {...pageProps} />

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
