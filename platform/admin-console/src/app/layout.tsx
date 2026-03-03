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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#05050A] text-gray-100 antialiased selection:bg-neo/30 selection:text-neo">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden relative">
              <Header />
              <main className="flex-1 overflow-y-auto bg-transparent p-6 sm:p-10 relative z-10">
                <div className="max-w-[1600px] mx-auto">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
