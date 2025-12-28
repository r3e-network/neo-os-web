import Link from "next/link";
import dynamic from "next/dynamic";

const ConnectButton = dynamic(() => import("@/components/features/wallet").then((m) => m.ConnectButton), {
  ssr: false,
});

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/miniapps", label: "MiniApps" },
  { href: "/stats", label: "Statistics" },
  { href: "/docs", label: "Docs" },
  { href: "/developer", label: "Developer" },
];

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500">
            <span className="text-lg font-bold text-white">N</span>
          </div>
          <span className="text-xl font-bold text-gray-900">Neo MiniApps</span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-primary-600"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Wallet Connection */}
        <div className="flex items-center gap-4">
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}
