// =============================================================================
// Root Layout — Neo v3
// =============================================================================

import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AdminAccessKeyPanel } from "@/components/layout/AdminAccessKeyPanel";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin Console — Neo MiniApp Platform",
  description: "Monitor and manage your MiniApp platform",
};

function AdminSecurityNotice() {
  const hasRealAuth =
    process.env.ADMIN_CONSOLE_SESSION_SECRET ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH0_DOMAIN;
  if (hasRealAuth) return null;
  return (
    <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
      <strong className="font-semibold">Admin console is unauthenticated.</strong>{" "}
      No session-auth provider is configured. Deploy behind a VPN / IP allowlist and provide an X-Admin-Key header on /api requests.
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-canvas text-ink antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col overflow-x-hidden md:h-screen md:flex-row md:overflow-hidden">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <AdminSecurityNotice />
              <div className="px-4 pt-4 sm:px-6 lg:px-8">
                <AdminAccessKeyPanel />
              </div>
              <main className="flex-1 overflow-y-auto bg-transparent p-4 sm:p-6 lg:p-8">
                <div className="mx-auto w-full max-w-[1440px]">{children}</div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
