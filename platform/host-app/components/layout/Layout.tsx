import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

interface LayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
}

export function Layout({ children, hideFooter }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[140] focus:px-4 focus:py-2 focus:bg-neo focus:text-gray-900 focus:rounded-lg focus:font-semibold"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
