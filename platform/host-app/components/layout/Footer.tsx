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
    { href: "https://twitter.com/neo_blockchain", label: "Twitter", icon: Twitter },
  ],
};

export function Footer() {
  return (
    <footer aria-label="Site footer" className="relative border-t border-gray-200/50 dark:border-white/5 bg-white/50 dark:bg-[#0A0B10]/80 backdrop-blur-2xl overflow-hidden mt-20">
      {/* Background Orbs */}
      <div className="absolute top-0 right-1/3 w-96 h-96 bg-neo/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#7000FF]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-[1600px] px-6 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-2 flex flex-col items-start pr-0 lg:pr-10">
            <Link href="/" className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo transition-transform hover:scale-105 inline-block">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#00E599] to-[#00A3FF] shadow-[0_0_20px_rgba(0,229,153,0.3)] group-hover:shadow-[0_0_25px_rgba(0,229,153,0.5)] transition-shadow duration-500">
                <span className="text-lg font-black text-white">N</span>
              </div>
              <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Neo<span className="text-neo">Hub</span>
              </span>
            </Link>
            <p className="mt-6 text-sm font-medium text-gray-600 dark:text-gray-400 leading-relaxed max-w-sm">
              The premier decentralized application marketplace and platform engineered exclusively on the blazing-fast Neo N3 blockchain.
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white mb-6">Platform</h3>
            <ul className="space-y-4">
              {footerLinks.platform.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-neo transition-colors outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded-md inline-block relative group"
                  >
                    <span className="relative z-10">{link.label}</span>
                    <span className="absolute left-0 bottom-0 w-0 h-[2px] bg-neo transition-all duration-300 group-hover:w-full opacity-50"></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white mb-6">Resources</h3>
            <ul className="space-y-4">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-neo transition-colors outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded-md inline-block relative group"
                  >
                    <span className="relative z-10">{link.label}</span>
                    <span className="absolute left-0 bottom-0 w-0 h-[2px] bg-neo transition-all duration-300 group-hover:w-full opacity-50"></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community Links */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white mb-6">Community</h3>
            <ul className="space-y-4">
              {footerLinks.community.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded-md inline-flex w-fit"
                    >
                      <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5 group-hover:bg-[#00E599]/10 group-hover:text-neo transition-colors border border-transparent group-hover:border-neo/20">
                        {Icon && <Icon size={16} />}
                      </div>
                      {link.label}
                      <span className="sr-only"> (opens in new tab)</span>
                    </a>
                  </li>
                );
              })}
              <li>
                <a
                  href="https://discord.gg/neo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2.5 mt-2"
                >
                  <div className="p-2 w-full rounded-xl bg-gradient-to-tr from-[#5865F2]/10 to-[#5865F2]/5 border border-[#5865F2]/20 hover:border-[#5865F2]/50 text-[#5865F2] hover:bg-[#5865F2]/10 transition-all font-bold text-xs flex justify-center items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                    </svg>
                    Join Discord
                  </div>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-16 border-t border-gray-200/50 dark:border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Neo MiniApp Platform.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
