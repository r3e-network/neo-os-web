// =============================================================================
// Root Layout
// =============================================================================

import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin Console - Neo MiniApp Platform",
  description: "Monitor and manage your MiniApp platform",
};

/**
 * Audit fix C-5: warn loudly when the admin console is rendered without
 * an upstream auth gate. The old middleware silently injected the admin
 * API key into every browser request, which made the console open-access
 * to anyone who could resolve its URL. That injection has been removed
 * (see src/middleware.ts), so all /api/* requests now require an explicit
 * x-admin-key or Authorization: Bearer header. Until a session-based
 * login flow is added, deploy this app strictly behind network-level
 * access control (VPN / IP allowlist).
 */
function AdminSecurityNotice() {
  const hasRealAuth =
    process.env.ADMIN_CONSOLE_SESSION_SECRET ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH0_DOMAIN;
  if (hasRealAuth) return null;
  return (
    <div
      role="alert"
      className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200"
    >
      <strong className="font-semibold">Admin console is unauthenticated.</strong>{" "}
      No session-auth provider is configured. Deploy behind a VPN / IP
      allowlist and provide an X-Admin-Key header on /api requests.
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased selection:bg-neo/30 selection:text-neo">
        <Providers>
          <div className="flex min-h-screen flex-col overflow-x-hidden md:h-screen md:flex-row md:overflow-hidden">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden relative">
              <Header />
              <AdminSecurityNotice />
              <main className="flex-1 overflow-y-auto bg-transparent p-4 sm:p-6 lg:p-10 relative z-10">
                <div className="mx-auto w-full max-w-[1600px]">{children}</div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
