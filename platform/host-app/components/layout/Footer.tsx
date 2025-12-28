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
    <footer className="border-t bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500">
                <span className="text-lg font-bold text-white">N</span>
              </div>
              <span className="text-xl font-bold">Neo MiniApps</span>
            </div>
            <p className="mt-4 text-sm text-gray-600">The future of decentralized applications on Neo N3.</p>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="font-semibold text-gray-900">Platform</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.platform.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-600 hover:text-primary-600">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="font-semibold text-gray-900">Resources</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-600 hover:text-primary-600">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community Links */}
          <div>
            <h3 className="font-semibold text-gray-900">Community</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.community.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 hover:text-primary-600"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t pt-8">
          <p className="text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Neo MiniApp Platform. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
