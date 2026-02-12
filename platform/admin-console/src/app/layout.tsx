// =============================================================================
// Root Layout
// =============================================================================

import type { Metadata } from "next";
import { Outfit } from "next/font/google"; // Import Outfit font
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Providers } from "./providers";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Admin Console - Neo MiniApp Platform",
  description: "Monitor and manage your MiniApp platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Add "dark" class to html to enforce dark mode by default for that premium feel
    <html lang="en" className={`dark ${outfit.className}`}>
      <body>
        <Providers>
          <div className="flex h-screen overflow-hidden bg-background text-foreground">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-6">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
