import Link from "next/link";
import { Github, Twitter } from "lucide-react";

const footerLinks = {
  platform: [
    { href: "/miniapps", label: "MiniApps" },
    { href: "/developer", label: "Developer" },
  ],
  resources: [
    { href: "/docs", label: "Documentation" },
    { href: "/docs/sdk", label: "SDK Guide" },
    { href: "/docs/api", label: "API Reference" },
  ],
  community: [
    { href: "https://github.com/neo-project", label: "GitHub", icon: Github },
    {
      href: "https://twitter.com/neo_blockchain",
      label: "Twitter",
      icon: Twitter,
    },
  ],
};

export function Footer() {
  return (
    <footer
      aria-label="Site footer"
      className="relative border-t border-gray-200 bg-white mt-20"
    >
      <div className="mx-auto max-w-[1600px] px-6 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-2 flex flex-col items-start pr-0 lg:pr-10">
            <Link
              href="/"
              className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-transform hover:scale-105 inline-block"
            >
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-blue-500 shadow-md">
                <span className="text-[10px] font-black text-white leading-none">
                  R3E
                </span>
              </div>
              <span className="text-2xl font-bold text-gray-900">
                R3E <span className="text-emerald-600">Network</span>
              </span>
            </Link>
            <p className="mt-6 text-sm font-medium text-gray-500 leading-relaxed max-w-sm">
              The premier decentralized application marketplace and platform
              engineered exclusively on the blazing-fast Neo N3 blockchain.
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="text-sm font-black uppercase text-gray-900 mb-6">
              Platform
            </h3>
            <ul className="space-y-4">
              {footerLinks.platform.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-gray-500 hover:text-emerald-600 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="text-sm font-black uppercase text-gray-900 mb-6">
              Resources
            </h3>
            <ul className="space-y-4">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-gray-500 hover:text-emerald-600 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community Links */}
          <div>
            <h3 className="text-sm font-black uppercase text-gray-900 mb-6">
              Community
            </h3>
            <ul className="space-y-4">
              {footerLinks.community.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md inline-flex w-fit"
                    >
                      <div className="p-1.5 rounded-lg bg-gray-100 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                        {Icon && <Icon size={16} />}
                      </div>
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-16 border-t border-gray-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-400">
            &copy; {new Date().getFullYear()} R3E Network. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/terms"
              className="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
