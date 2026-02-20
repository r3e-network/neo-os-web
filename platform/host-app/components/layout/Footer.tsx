import Link from "next/link";

const footerLinks = {
  platform: [
    { href: "/miniapps", label: "MiniApps" },
    { href: "/stats", label: "Statistics" },
    { href: "/developer", label: "Developer" },
  ],
  resources: [
    { href: "/docs", label: "Documentation" },
    { href: "/docs/sdk", label: "SDK Guide" },
    { href: "/docs/api", label: "API Reference" },
  ],
  community: [
    { href: "https://github.com/neo-project", label: "GitHub" },
    { href: "https://discord.gg/neo", label: "Discord" },
    { href: "https://twitter.com/neo_blockchain", label: "Twitter" },
  ],
};

export function Footer() {
  return (
    <footer aria-label="Site footer" className="border-t border-gray-200 bg-gray-50 dark:bg-gray-950 dark:border-gray-800">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neo">
                <span className="text-lg font-bold text-white">N</span>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">Neo MiniApps</span>
            </div>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">The future of decentralized applications on Neo N3.</p>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Platform</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.platform.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-neo transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded-lg"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Resources</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-neo transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded-lg"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community Links */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Community</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.community.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-neo transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded-lg"
                  >
                    {link.label}
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t dark:border-gray-800 pt-8">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Neo MiniApp Platform. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
