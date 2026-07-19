import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useI18n } from "@/lib/i18n/react";

interface LayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
}

export function Layout({ children, hideFooter }: LayoutProps) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[140] focus:rounded-lg focus:bg-neo-500 focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
      >
        {t("navigation.skipToContent", "common")}
      </a>
      <Navbar />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
