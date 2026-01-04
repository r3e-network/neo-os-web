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
    <footer className="border-t bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/logo-icon.png" alt="NeoHub" className="h-8 w-8" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">NeoHub</span>
            </div>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{t("footer.tagline")}</p>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{t("footer.platform")}</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.platform.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{t("footer.resources")}</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community Links */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{t("footer.community")}</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.community.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    {t(link.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-gray-200 dark:border-gray-800 pt-8">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} R3E Network. {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
