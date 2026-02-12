import Link from "next/link";
import { useTranslation } from "@/lib/i18n/react";

const footerLinks = {
  platform: [
    { href: "/miniapps", labelKey: "navigation.miniapps" },
    { href: "/stats", labelKey: "navigation.stats" },
    { href: "/developer", labelKey: "navigation.developer" },
  ],
  resources: [
    { href: "/docs", labelKey: "navigation.docs" },
    { href: "/docs?section=js-sdk", labelKey: "footer.sdkGuide" },
    { href: "/docs?section=rest-api", labelKey: "footer.apiReference" },
  ],
  community: [
    { href: "https://github.com/R3E-Network", labelKey: "footer.github" },
    { href: "https://discord.gg/neo", labelKey: "footer.discord" },
    { href: "https://twitter.com/neo_blockchain", labelKey: "footer.twitter" },
  ],
};

export function Footer() {
  const { t } = useTranslation("common");

  return (
    <footer className="relative border-t border-white/60 dark:border-white/10 bg-white/70 dark:bg-erobo-bg-dark pt-16 pb-12 overflow-hidden">
      {/* Glass Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-erobo-purple/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-erobo-peach/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 z-10">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4 mb-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-erobo-purple/50 blur-lg rounded-full opacity-50" />
                <img src="/logo.png" alt="NeoHub" className="relative h-8 w-8" />
              </div>
              <span className="text-xl font-bold text-erobo-ink dark:text-white tracking-tight">
                Neo<span className="text-erobo-purple">Hub</span>
              </span>
            </div>
            <p className="text-sm font-medium text-erobo-ink-soft/80 dark:text-slate-400 leading-relaxed max-w-xs">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="text-sm font-bold text-erobo-ink dark:text-white uppercase mb-6 tracking-wider">
              {t("footer.platform")}
            </h3>
            <ul className="space-y-3">
              {footerLinks.platform.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-erobo-ink-soft/80 dark:text-slate-400 hover:text-erobo-purple transition-colors"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="text-sm font-bold text-erobo-ink dark:text-white uppercase mb-6 tracking-wider">
              {t("footer.resources")}
            </h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-erobo-ink-soft/80 dark:text-slate-400 hover:text-erobo-purple transition-colors"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community Links */}
          <div>
            <h3 className="text-sm font-bold text-erobo-ink dark:text-white uppercase mb-6 tracking-wider">
              {t("footer.community")}
            </h3>
            <ul className="space-y-3">
              {footerLinks.community.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-erobo-ink-soft/80 dark:text-slate-400 hover:text-erobo-purple transition-colors"
                  >
                    {t(link.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/60 dark:border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p suppressHydrationWarning className="text-sm font-medium text-erobo-ink-soft/70 dark:text-slate-500">
            © {new Date().getFullYear()} R3E Network. {t("footer.rights")}
          </p>
          {/* Powered by Neo Badge */}
          <a
            href="https://neo.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00E599]/10 border border-[#00E599]/30 hover:bg-[#00E599]/20 transition-all group"
          >
            <span className="text-sm font-medium text-erobo-ink-soft/80 dark:text-slate-400 group-hover:text-[#00E599] transition-colors">
              {t("footer.poweredBy")}
            </span>
            <img src="/chains/neo.svg" alt="Neo" className="h-5 w-5" />
            <span className="text-sm font-bold text-[#00E599]">Neo</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
