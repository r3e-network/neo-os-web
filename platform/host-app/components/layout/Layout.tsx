import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

interface LayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
}

export function Layout({ children, hideFooter }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950 text-black dark:text-white font-sans selection:bg-neo selection:text-black">
      <Navbar />
      <main className="flex-1 relative">
        {/* Background Texture for the whole app */}
        <div className="fixed inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_1px_1px,#000_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] bg-[size:20px_20px] -z-10" />
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
