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
    <footer className="relative border-t-4 border-black bg-white pt-16 pb-12 overflow-hidden">
      {/* Brutalist Pattern Background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_1px_1px,#000_1px,transparent_0)] bg-[size:16px_16px]" />

      <div className="relative mx-auto max-w-7xl px-6 z-10">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4 mb-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="inline-flex items-center gap-3 bg-black p-3 border-2 border-black shadow-[4px_4px_0_#00E599] -rotate-1 mb-6 hover:rotate-0 transition-transform">
              <img src="/logo-icon.png" alt="NeoHub" className="h-8 w-8" />
              <span className="text-xl font-black text-white uppercase tracking-tighter">NeoHub</span>
            </div>
            <p className="text-sm font-bold text-black border-l-4 border-neo pl-4 uppercase leading-relaxed max-w-xs">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="text-lg font-black text-black uppercase mb-6 flex items-center gap-2">
              <span className="w-4 h-4 bg-neo border-2 border-black" />
              {t("footer.platform")}
            </h3>
            <ul className="space-y-3">
              {footerLinks.platform.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-block text-sm font-bold text-black uppercase hover:bg-neo hover:px-2 hover:-ml-2 transition-all border border-transparent hover:border-black"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="text-lg font-black text-black uppercase mb-6 flex items-center gap-2">
              <span className="w-4 h-4 bg-brutal-yellow border-2 border-black" />
              {t("footer.resources")}
            </h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-block text-sm font-bold text-black uppercase hover:bg-brutal-yellow hover:px-2 hover:-ml-2 transition-all border border-transparent hover:border-black"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community Links */}
          <div>
            <h3 className="text-lg font-black text-black uppercase mb-6 flex items-center gap-2">
              <span className="w-4 h-4 bg-brutal-red border-2 border-black" />
              {t("footer.community")}
            </h3>
            <ul className="space-y-3">
              {footerLinks.community.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm font-bold text-black uppercase hover:bg-brutal-red hover:text-white hover:px-2 hover:-ml-2 transition-all border border-transparent hover:border-black"
                  >
                    {t(link.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t-4 border-black pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm font-black text-black/50 uppercase">
            © {new Date().getFullYear()} R3E Network. {t("footer.rights")}
          </p>
          <div className="flex gap-4">
            {/* Decorative element or links could go here */}
            <div className="h-4 w-32 bg-[repeating-linear-gradient(45deg,#000,#000_2px,transparent_2px,transparent_8px)] opacity-20" />
          </div>
        </div>
      </div>
    </footer>
  );
}
