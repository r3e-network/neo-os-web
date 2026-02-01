import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { SocialAccountSetupProvider } from "@/components/providers";

interface LayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
}

export function Layout({ children, hideFooter }: LayoutProps) {
  return (
    <SocialAccountSetupProvider>
      <div className="flex min-h-screen flex-col bg-transparent text-foreground font-sans selection:bg-erobo-purple/30 selection:text-erobo-ink">
        <Navbar />
        <main className="flex-1 relative">
          {/* Background Texture for the whole app */}
          <div className="fixed inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_1px_1px,rgba(159,157,243,0.2)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.12)_1px,transparent_0)] bg-[size:24px_24px] -z-10" />
          {children}
        </main>
        {!hideFooter && <Footer />}
      </div>
    </SocialAccountSetupProvider>
  );
}
