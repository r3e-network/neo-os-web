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
    <footer className="relative border-t border-gray-200 dark:border-white/5 bg-white dark:bg-[#050505] pt-16 pb-12 overflow-hidden">
      {/* Glass Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-neo/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-electric-purple/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 z-10">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4 mb-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-neo/50 blur-lg rounded-full opacity-50" />
                <img src="/logo-icon.png" alt="NeoHub" className="relative h-8 w-8" />
              </div>
              <span className="text-xl font-bold text-black dark:text-white tracking-tight">Neo<span className="text-[#00E599]">Hub</span></span>
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="text-sm font-bold text-black dark:text-white uppercase mb-6 tracking-wider">
              {t("footer.platform")}
            </h3>
            <ul className="space-y-3">
              {footerLinks.platform.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-neo transition-colors"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="text-sm font-bold text-black dark:text-white uppercase mb-6 tracking-wider">
              {t("footer.resources")}
            </h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-neo transition-colors"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community Links */}
          <div>
            <h3 className="text-sm font-bold text-black dark:text-white uppercase mb-6 tracking-wider">
              {t("footer.community")}
            </h3>
            <ul className="space-y-3">
              {footerLinks.community.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-neo transition-colors"
                  >
                    {t(link.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-200 dark:border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} R3E Network. {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
