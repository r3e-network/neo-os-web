import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";
import {
  Search,
  Rocket,
  ChevronRight,
  Copy,
  Check,
  Zap,
  Shield,
  ArrowRight,
  Database,
  Code2,
  Globe,
  Clock,
  Menu,
  X,
  Plus,
  ArrowUpRight,
  ChevronDown,
  Cpu,
  Layers,
  Key,
  Play,
  Eye,
  User,
  Wallet,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Types
interface DocItem {
  id: string;
  title: string;
}

interface DocSection {
  id: string;
  title: string;
  icon: any;
  items: DocItem[];
}

// Sidebar Definitions
const getDocSections = (t: any): DocSection[] => [
  {
    id: "getting-started",
    title: t("docs.sidebar.gettingStarted"),
    icon: Zap,
    items: [
      { id: "intro", title: t("docs.items.intro") },
      { id: "quickstart", title: t("docs.items.quickstart") },
      { id: "auth", title: t("docs.items.auth") },
      { id: "api-keys", title: t("docs.items.api-keys") },
    ],
  },
  {
    id: "architecture",
    title: t("docs.sidebar.architecture"),
    icon: Cpu,
    items: [
      { id: "tee-root", title: t("docs.items.tee-root") },
      { id: "service-os", title: t("docs.items.service-os") },
      { id: "capabilities", title: t("docs.items.capabilities") },
      { id: "security-model", title: t("docs.items.security-model") },
    ],
  },
  {
    id: "services",
    title: t("docs.sidebar.services"),
    icon: Database,
    items: [
      { id: "oracle", title: t("docs.items.oracle") },
      { id: "vrf", title: t("docs.items.vrf") },
      { id: "secrets", title: t("docs.items.secrets") },
      { id: "datafeeds", title: t("docs.items.datafeeds") },
      { id: "automation", title: t("docs.items.automation") },
      { id: "gasbank", title: t("docs.items.gasbank") },
      { id: "mixer", title: t("docs.items.mixer") },
      { id: "ccip", title: t("docs.items.ccip") },
    ],
  },
  {
    id: "api-reference",
    title: t("docs.sidebar.apiReference"),
    icon: Code2,
    items: [
      { id: "rest-api", title: t("docs.items.rest-api") },
      { id: "websocket", title: t("docs.items.websocket") },
      { id: "errors", title: t("docs.items.errors") },
      { id: "limits", title: t("docs.items.limits") },
    ],
  },
  {
    id: "sdks",
    title: t("docs.sidebar.sdks"),
    icon: Globe,
    items: [
      { id: "js-sdk", title: t("docs.items.js-sdk") },
      { id: "go-sdk", title: t("docs.items.go-sdk") },
      { id: "python-sdk", title: t("docs.items.python-sdk") },
      { id: "cli", title: t("docs.items.cli") },
    ],
  },
];

// Code block component with copy functionality
function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-xl bg-gray-900/90 dark:bg-black/40 border border-gray-800 dark:border-white/5 overflow-hidden my-6">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 dark:border-white/5 bg-gray-900/50">
        <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">{language}</span>
        <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-white/5 transition-colors">
          {copied ? <Check size={14} className="text-neo" /> : <Copy size={14} className="text-gray-500" />}
        </button>
      </div>
      <pre className="p-5 overflow-x-auto text-sm leading-relaxed scrollbar-thin scrollbar-thumb-white/10">
        <code className="text-slate-300 font-mono">{code}</code>
      </pre>
    </div>
  );
}

// Comparison Table for structured data
function ComparisonTable({ headers, rows, title }: { headers: string[]; rows: string[][]; title?: string }) {
  return (
    <div className="my-8 not-prose">
      {title && <h4 className="text-lg font-bold mb-4">{title}</h4>}
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/5">
        <table className="w-full text-left border-collapse bg-white dark:bg-dark-900/20">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="py-3 px-4 text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors"
              >
                {row.map((cell, j) => (
                  <td key={j} className="py-3 px-4 text-sm text-slate-500 dark:text-slate-400">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DocsPage() {
  const { t } = useTranslation("host");
  const router = useRouter();
  const [activeItem, setActiveItem] = useState("intro");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const docSections = getDocSections(t);

  // Handle URL query parameter for section navigation
  useEffect(() => {
    const section = router.query.section as string;
    if (section) {
      const allItems = docSections.flatMap((s) => s.items);
      if (allItems.some((item) => item.id === section)) {
        setActiveItem(section);
      }
    }
  }, [router.query.section]);

  // Auto-close mobile menu on item select
  const handleItemSelect = (id: string) => {
    setActiveItem(id);
    setMobileMenuOpen(false);
    // Update URL without full page reload
    router.push(`/docs?section=${id}`, undefined, { shallow: true });
  };

  return (
    <Layout>
      <Head>
        <title>{t("docs.title")} | NeoHub</title>
      </Head>

      <div className="flex flex-col lg:flex-row min-h-screen bg-white dark:bg-dark-950">
        {/* Mobile Navbar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5 sticky top-16 z-30 bg-white/80 dark:bg-dark-950/80 backdrop-blur-md">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-bold text-gray-900 dark:text-white">{t("docs.title")}</span>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Sidebar Container */}
        <aside
          className={cn(
            "fixed inset-0 top-[113px] lg:top-20 z-20 transition-transform lg:translate-x-0 lg:static lg:h-[calc(100vh-80px)] lg:w-72 shrink-0 border-r border-gray-100 dark:border-white/5 bg-white dark:bg-dark-950 overflow-y-auto no-scrollbar",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="p-6">
            <nav className="space-y-8">
              {docSections.map((section) => (
                <div key={section.id}>
                  <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-800 dark:text-slate-200 mb-2 px-2">
                    <section.icon size={16} className="text-slate-400" />
                    {section.title}
                  </h3>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = activeItem === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemSelect(item.id)}
                          className={cn(
                            "w-full flex items-center px-8 py-2 text-[14px] rounded-lg transition-all",
                            isActive
                              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5",
                          )}
                        >
                          {item.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-6 lg:px-16 py-12 lg:py-20 max-w-5xl scroll-smooth no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeItem}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {activeItem === "intro" && <IntroContent t={t} />}
              {activeItem === "quickstart" && <QuickStartContent t={t} />}
              {activeItem === "auth" && <AuthContent t={t} />}
              {activeItem === "api-keys" && <APIKeysContent t={t} />}
              {activeItem === "tee-root" && <ArchitectureDetail id="tee-root" t={t} />}
              {activeItem === "service-os" && <ArchitectureDetail id="service-os" t={t} />}
              {activeItem === "capabilities" && <ArchitectureDetail id="capabilities" t={t} />}
              {activeItem === "security-model" && <SecurityModelContent t={t} />}
              {activeItem === "oracle" && <ServiceDetail id="oracle" t={t} />}
              {activeItem === "vrf" && <ServiceDetail id="vrf" t={t} />}
              {activeItem === "secrets" && <ServiceDetail id="secrets" t={t} />}
              {activeItem === "datafeeds" && <ServiceDetail id="datafeeds" t={t} />}
              {activeItem === "automation" && <ServiceDetail id="automation" t={t} />}
              {activeItem === "gasbank" && <ServiceDetail id="gasbank" t={t} />}
              {activeItem === "mixer" && <ServiceDetail id="mixer" t={t} />}
              {activeItem === "ccip" && <ServiceDetail id="ccip" t={t} />}
              {activeItem === "rest-api" && <APIReferenceDetail id="rest-api" t={t} />}
              {activeItem === "websocket" && <APIReferenceDetail id="websocket" t={t} />}
              {activeItem === "errors" && <APIReferenceDetail id="errors" t={t} />}
              {activeItem === "limits" && <APIReferenceDetail id="limits" t={t} />}
              {activeItem === "js-sdk" && <SDKDetail id="js-sdk" t={t} />}
              {activeItem === "go-sdk" && <SDKDetail id="go-sdk" t={t} />}
              {activeItem === "python-sdk" && <SDKDetail id="python-sdk" t={t} />}
              {activeItem === "cli" && <SDKDetail id="cli" t={t} />}

              {/* Navigation Helper */}
              <div className="mt-20 pt-10 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div /> {/* Spacer */}
                <button
                  onClick={() => {
                    const allItems = docSections.flatMap((s) => s.items);
                    const currentIndex = allItems.findIndex((i) => i.id === activeItem);
                    if (currentIndex < allItems.length - 1) {
                      handleItemSelect(allItems[currentIndex + 1].id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className="group flex flex-col items-end gap-2 text-right"
                >
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t("docs.navNext")}</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-neo transition-colors flex items-center gap-2">
                    {t("docs.navNextTopic")}{" "}
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </Layout>
  );
}

// Sub-components for documentation content
function IntroContent({ t }: { t: any }) {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-4xl font-black mb-8 tracking-tight">{t("docs.items.intro")}</h1>
      <p className="text-xl text-slate-400 leading-relaxed mb-10">{t("docs.intro.welcome")}</p>

      {/* Platform Layers Figure */}
      <div className="my-16 flex flex-col items-center not-prose">
        <div className="w-full max-w-md space-y-4">
          <div className="p-4 rounded-xl bg-neo/20 border border-neo/30 text-center shadow-lg shadow-neo/10 group hover:scale-[1.02] transition-transform">
            <span className="text-xs font-black text-neo uppercase tracking-[0.2em]">{t("docs.architecture.appLayer")}</span>
            <div className="text-white font-bold text-sm mt-1">MiniApps & Frontends</div>
          </div>
          <div className="w-0.5 h-6 bg-slate-800 mx-auto" />
          <div className="p-4 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-center shadow-lg shadow-indigo-500/10 group hover:scale-[1.02] transition-transform">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em]">{t("docs.architecture.osLayer")}</span>
            <div className="text-white font-bold text-sm mt-1">ServiceOS (TEE Runtime)</div>
          </div>
          <div className="w-0.5 h-6 bg-slate-800 mx-auto" />
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-center shadow-lg group hover:scale-[1.02] transition-transform relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">{t("docs.architecture.hardwareLayer")}</span>
            <div className="text-slate-300 font-bold text-sm mt-1">Intel SGX / TEE Root</div>
          </div>
        </div>
        <p className="mt-8 text-xs text-slate-500 uppercase tracking-widest font-bold">Concept: Multi-Layer Hardware Security</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-12 not-prose">
        <div className="p-6 rounded-2xl bg-gray-50 dark:bg-dark-900 border border-gray-100 dark:border-white/5">
          <Shield className="text-neo mb-4" size={32} />
          <h3 className="text-lg font-bold mb-2">{t("docs.intro.secureTitle")}</h3>
          <p className="text-sm text-slate-400">{t("docs.intro.secureDesc")}</p>
        </div>
        <div className="p-6 rounded-2xl bg-gray-50 dark:bg-dark-900 border border-gray-100 dark:border-white/5">
          <Zap className="text-neo mb-4" size={32} />
          <h3 className="text-lg font-bold mb-2">{t("docs.intro.identityTitle")}</h3>
          <p className="text-sm text-slate-400">{t("docs.intro.identityDesc")}</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-6">{t("docs.intro.whatIs")}</h2>
      <p>{t("docs.intro.whatIsDesc")}</p>

      <div className="bg-indigo-500/10 border-l-4 border-indigo-500 p-6 my-10 rounded-r-2xl">
        <h4 className="font-bold text-indigo-400 mb-2">{t("docs.intro.didYouKnow")}</h4>
        <p className="text-sm text-indigo-200/80 m-0">{t("docs.intro.didYouKnowDesc")}</p>
      </div>
    </div>
  );
}

function QuickStartContent({ t }: { t: any }) {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-4xl font-black mb-8 tracking-tight">{t("docs.items.quickstart")}</h1>
      <p className="text-lg text-slate-400">{t("docs.subtitle")}</p>

      <h2 className="text-2xl font-bold mt-12 mb-6">{t("docs.quickstart.userTitle")}</h2>
      <div className="space-y-8 not-prose mt-8">
        {(t("docs.quickstart.userSteps", { returnObjects: true }) as any[]).map((item, idx) => (
          <div key={idx} className="flex gap-6 items-start group">
            <div className="text-4xl font-black text-neo opacity-20 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              0{idx + 1}
            </div>
            <div className="pt-2">
              <h4 className="text-lg font-bold mb-1">{item.title}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-bold mt-16 mb-6">{t("docs.quickstart.devTitle")}</h2>
      <p>{t("docs.quickstart.installSdk")}</p>
      <CodeBlock code="npm install @neohub/sdk" language="bash" />

      <p className="mt-8">{t("docs.quickstart.initSdk")}</p>
      <CodeBlock
        code={`import { NeoHub } from "@neohub/sdk";

const hub = new NeoHub({
  appId: "my-cool-app",
  network: "testnet"
});

await hub.connect();`}
        language="javascript"
      />

      <div className="mt-12 p-8 rounded-3xl bg-dark-900 border border-white/5 flex flex-col items-center text-center not-prose">
        <div className="w-16 h-16 rounded-2xl bg-neo/10 flex items-center justify-center mb-6">
          <Play className="text-neo" size={32} />
        </div>
        <h3 className="text-xl font-bold mb-2">{t("docs.quickstart.playgroundTitle")}</h3>
        <p className="text-slate-400 text-sm mb-6">{t("docs.quickstart.playgroundDesc")}</p>
        <Link href="/playground">
          <Button className="bg-neo hover:bg-neo/90 text-dark-950 px-8 rounded-xl font-bold">
            {t("docs.quickstart.launchPlayground")} <ArrowRight className="ml-2" size={16} />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function AuthContent({ t }: { t: any }) {
  const comparisonHeaders = [t("docs.auth.table.feature"), t("docs.auth.socialTitle"), t("docs.auth.walletTitle")];
  const comparisonRows = t("docs.auth.table.rows", { returnObjects: true }) as string[][];

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-4xl font-black mb-8 tracking-tight">{t("docs.items.auth")}</h1>
      <p className="text-lg text-slate-400">{t("docs.auth.subtitle")}</p>

      {/* Visual Auth Flow */}
      <div className="my-12 p-8 rounded-3xl bg-dark-900 border border-white/5 not-prose overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-emerald-500/5" />
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-10 relative z-10 text-center">
          Authentication Flow
        </h4>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12">
          {/* Social Box */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <User size={32} className="text-indigo-400" />
            </div>
            <span className="text-xs font-bold text-indigo-400 uppercase">Social Login</span>
          </div>

          <ArrowRight className="text-slate-700 hidden md:block" size={24} />
          <div className="w-0.5 h-8 bg-slate-800 md:hidden" />

          {/* NeoHub Enclave */}
          <div className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-neo/10 border border-neo/30 flex items-center justify-center">
              <Shield size={24} className="text-neo" />
            </div>
            <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Identity Mapping</span>
          </div>

          <ArrowRight className="text-slate-700 hidden md:block" size={24} />
          <div className="w-0.5 h-8 bg-slate-800 md:hidden" />

          {/* Wallet Box */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Wallet size={32} className="text-emerald-400" />
            </div>
            <span className="text-xs font-bold text-emerald-400 uppercase">Neo Wallet</span>
          </div>
        </div>
        <p className="mt-10 text-[11px] text-slate-500 text-center max-w-md mx-auto relative z-10">
          Unified identity links your social profile with your blockchain address within the secure enclave.
        </p>
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-6">{t("docs.auth.comparisonTitle")}</h2>
      <p>{t("docs.auth.comparisonDesc")}</p>

      <ComparisonTable headers={comparisonHeaders} rows={comparisonRows} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-10 not-prose">
        <div className="p-8 rounded-2xl bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20">
          <h4 className="font-bold text-indigo-600 dark:text-indigo-400 mb-2">{t("docs.auth.socialTitle")}</h4>
          <ul className="text-sm space-y-2 text-slate-600 dark:text-slate-400 list-disc pl-4">
            {(t("docs.auth.socialItems", { returnObjects: true }) as string[]).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="p-8 rounded-2xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20">
          <h4 className="font-bold text-emerald-600 dark:text-emerald-400 mb-2">{t("docs.auth.walletTitle")}</h4>
          <ul className="text-sm space-y-2 text-slate-600 dark:text-slate-400 list-disc pl-4">
            {(t("docs.auth.walletItems", { returnObjects: true }) as string[]).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-6">{t("docs.items.security-tip")}</h2>
      <p>{t("docs.auth.tipDesc")}</p>
    </div>
  );
}

function APIKeysContent({ t }: { t: any }) {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-4xl font-black mb-8 tracking-tight">{t("docs.items.api-keys")}</h1>
      <p className="text-lg text-slate-400">{t("docs.apiKeys.subtitle")}</p>

      <h2 className="text-2xl font-bold mt-12 mb-6">{t("docs.apiKeys.createTitle")}</h2>
      <p>{t("docs.apiKeys.createDesc")}</p>

      <div className="bg-amber-500/10 border-l-4 border-amber-500 p-6 my-10 rounded-r-2xl">
        <h4 className="font-bold text-amber-500 mb-2">{t("docs.apiKeys.warningTitle")}</h4>
        <p className="text-sm text-amber-200/80 m-0">{t("docs.apiKeys.warningDesc")}</p>
      </div>

      <h3 className="text-xl font-bold mb-4">{t("docs.apiKeys.usageTitle")}</h3>
      <CodeBlock
        code={`const hub = new NeoHub({
  apiKey: "nh_live_xxxxxxxxxxxxxxxx",
  network: "testnet"
});`}
        language="javascript"
      />
    </div>
  );
}

function SecurityModelContent({ t }: { t: any }) {
  const securityComparisonHeaders = [t("docs.securityModel.table.level"), t("docs.securityModel.table.traditional"), t("docs.securityModel.table.neohub")];
  const securityComparisonRows = t("docs.securityModel.table.rows", { returnObjects: true }) as string[][];

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-4xl font-black mb-8 tracking-tight">{t("docs.items.security-model")}</h1>
      <p className="text-lg text-slate-400">{t("docs.securityModel.subtitle")}</p>

      <h2 className="text-2xl font-bold mt-12 mb-6">{t("docs.securityModel.isolationTitle")}</h2>
      <p>{t("docs.securityModel.isolationDesc")}</p>

      <ComparisonTable
        title={t("docs.securityModel.table.title")}
        headers={securityComparisonHeaders}
        rows={securityComparisonRows}
      />

      <div className="my-10 p-8 rounded-3xl bg-dark-900 border border-white/5 not-prose">
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-neo/10 flex items-center justify-center shrink-0">
              <Shield size={20} className="text-neo" />
            </div>
            <div>
              <h4 className="font-bold text-white mb-1">{t("docs.securityModel.zeroTitle")}</h4>
              <p className="text-sm text-slate-400">{t("docs.securityModel.zeroDesc")}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <Lock size={20} className="text-blue-400" />
            </div>
            <div>
              <h4 className="font-bold text-white mb-1">{t("docs.securityModel.attestationTitle")}</h4>
              <p className="text-sm text-slate-400">{t("docs.securityModel.attestationDesc")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchitectureDetail({ id, t }: { id: string; t: any }) {
  const titles: Record<string, string> = {
    "tee-root": t("docs.items.tee-root"),
    "service-os": t("docs.items.service-os"),
    capabilities: t("docs.items.capabilities"),
  };

  const key = id === "tee-root" ? "teeRoot" : id === "service-os" ? "serviceOS" : "capabilities";
  const subtitle = t(`docs.architecture.${key}.subtitle`, { defaultValue: t("docs.architecture.subtitle", { title: titles[id] }) });
  const howItWorks = t(`docs.architecture.${key}.howItWorks`, { defaultValue: t("docs.architecture.howItWorksDesc", { title: titles[id] }) });
  const integrity = t(`docs.architecture.${key}.integrity`, { defaultValue: t("docs.architecture.integrityDesc") });
  const confidentiality = t(`docs.architecture.${key}.confidentiality`, { defaultValue: t("docs.architecture.confidentialityDesc") });

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-4xl font-black mb-8 tracking-tight">{titles[id]}</h1>
      <p className="text-lg text-slate-400">{subtitle}</p>

      <div className="my-10 aspect-video rounded-3xl bg-dark-900 border border-white/5 flex items-center justify-center relative overflow-hidden not-prose">
        <div className="absolute inset-0 bg-gradient-to-br from-neo/10 to-transparent" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-neo/10 flex items-center justify-center border border-neo/30 animate-pulse">
            <Cpu size={40} className="text-neo" />
          </div>
          <p className="text-sm font-mono text-neo/60 uppercase tracking-widest">{t("docs.architecture.schematic")}</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-6">{t("docs.architecture.howItWorks")}</h2>
      <p>{howItWorks}</p>

      <ComparisonTable
        title={t("docs.architecture.layers.title")}
        headers={["Layer", "Technology", "Pillars"]}
        rows={t("docs.architecture.layers.rows", { returnObjects: true }) as string[][]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-10 not-prose">
        <div className="p-8 rounded-2xl bg-gray-50 dark:bg-dark-900/50 border border-gray-100 dark:border-white/5">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neo" /> {t("docs.architecture.integrity")}
          </h4>
          <p className="text-sm text-slate-400 m-0">{integrity}</p>
        </div>
        <div className="p-8 rounded-2xl bg-gray-50 dark:bg-dark-900/50 border border-gray-100 dark:border-white/5">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" /> {t("docs.architecture.confidentiality")}
          </h4>
          <p className="text-sm text-slate-400 m-0">{confidentiality}</p>
        </div>
      </div>
    </div>
  );
}

function ServiceDetail({ id, t }: { id: string; t: any }) {
  const titles: Record<string, string> = {
    oracle: t("docs.items.oracle"),
    vrf: t("docs.items.vrf"),
    secrets: t("docs.items.secrets"),
    datafeeds: t("docs.items.datafeeds"),
    automation: t("docs.items.automation"),
    gasbank: t("docs.items.gasbank"),
    mixer: t("docs.items.mixer"),
    ccip: t("docs.items.ccip"),
  };

  // Get service-specific content from translations
  const subtitle = t(`docs.${id}.subtitle`, { defaultValue: "" });
  const overview = t(`docs.${id}.overview`, { defaultValue: "" });
  const features = t(`docs.${id}.features`, { returnObjects: true, defaultValue: [] });
  const codeExample = t(`docs.${id}.codeExample`, { defaultValue: "" });
  const pricing = t(`docs.${id}.pricing`, { defaultValue: "" });

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-4xl font-black mb-8 tracking-tight">{titles[id]}</h1>
      <p className="text-lg text-slate-400">{subtitle || t("docs.services.subtitle", { title: titles[id] })}</p>

      <h2 className="text-2xl font-bold mt-12 mb-6">{t("docs.services.overview")}</h2>
      <p>{overview || t("docs.services.overviewDesc", { title: titles[id] })}</p>

      {/* Features List */}
      {Array.isArray(features) && features.length > 0 && (
        <div className="my-8 not-prose">
          <ul className="space-y-3">
            {features.map((feature: string, idx: number) => (
              <li key={idx} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-neo/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={12} className="text-neo" />
                </div>
                <span className="text-slate-600 dark:text-slate-300">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="text-2xl font-bold mt-12 mb-6">{t("docs.services.implementation")}</h2>
      <CodeBlock
        code={
          codeExample ||
          `// Example usage of ${id} service
const result = await hub.${id}.fetch({
  target: "NX..." ,
  param: "value"
});

console.log("Verified result:", result);`
        }
        language="javascript"
      />

      {/* Pricing Info */}
      {pricing && (
        <div className="mt-8 p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 not-prose">
          <div className="flex items-center gap-3 text-amber-500 mb-2">
            <Zap size={20} />
            <span className="font-bold text-sm">Pricing</span>
          </div>
          <p className="text-sm text-slate-400 m-0">{pricing}</p>
        </div>
      )}

      <div className="mt-8 p-6 rounded-2xl bg-neo/5 border border-neo/20 not-prose">
        <div className="flex items-center gap-3 text-neo mb-2">
          <Eye size={20} />
          <span className="font-bold text-sm">{t("docs.services.realTime")}</span>
        </div>
        <p className="text-xs text-slate-400 m-0">{t("docs.services.realTimeDesc")}</p>
      </div>
    </div>
  );
}

function APIReferenceDetail({ id, t }: { id: string; t: any }) {
  const idMap: Record<string, string> = {
    "rest-api": "restApi",
    websocket: "websocket",
    errors: "errors",
    limits: "limits",
  };
  const key = idMap[id] || id;

  const titles: Record<string, string> = {
    "rest-api": t("docs.items.rest-api"),
    websocket: t("docs.items.websocket"),
    errors: t("docs.items.errors"),
    limits: t("docs.items.limits"),
  };

  const subtitle = t(`apiReference.${key}.subtitle`, { defaultValue: "" });

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-4xl font-black mb-8 tracking-tight">{titles[id]}</h1>
      <p className="text-lg text-slate-400">{subtitle}</p>

      {id === "rest-api" && (
        <>
          <div className="my-8 p-6 rounded-2xl bg-dark-900 border border-white/5 not-prose font-mono">
            <p className="text-neo text-sm mb-2">{t("apiReference.restApi.baseUrl")}</p>
            <p className="text-slate-400 text-sm">{t("apiReference.restApi.authHeader")}</p>
          </div>

          <h3 className="text-xl font-bold mb-4">Common Headers</h3>
          <ComparisonTable
            headers={["Header", "Required", "Description"]}
            rows={[
              ["Authorization", "Yes", "Bearer <API_KEY>"],
              ["Content-Type", "Yes", "application/json"],
              ["X-Neo-Network", "No", "testnet | mainnet (default: mainnet)"]
            ]}
          />

          <h2 className="text-2xl font-bold mt-12 mb-6">Endpoints</h2>
          <div className="space-y-4 not-prose">
            {Object.entries(t("apiReference.restApi.endpoints", { returnObjects: true }) as Record<string, string>).map(
              ([k, v]) => (
                <div
                  key={k}
                  className="p-4 rounded-xl bg-gray-50 dark:bg-dark-900/50 border border-gray-100 dark:border-white/5"
                >
                  <code className="text-neo text-sm">{v}</code>
                </div>
              ),
            )}
          </div>
        </>
      )}

      {id === "websocket" && (
        <>
          <div className="my-8 p-6 rounded-2xl bg-dark-900 border border-white/5 not-prose font-mono">
            <p className="text-neo text-sm">{t("apiReference.websocket.endpoint")}</p>
          </div>
          <h2 className="text-2xl font-bold mt-12 mb-6">Channels</h2>
          <div className="flex flex-wrap gap-2 not-prose">
            {(t("apiReference.websocket.channels", { returnObjects: true }) as string[]).map((ch, idx) => (
              <span key={idx} className="px-3 py-1 rounded-full bg-neo/10 text-neo text-sm">
                {ch}
              </span>
            ))}
          </div>
          <CodeBlock code={t("apiReference.websocket.example")} language="javascript" />
        </>
      )}

      {id === "errors" && (
        <ComparisonTable
          headers={["Code", "Description"]}
          rows={Object.entries(t("apiReference.errors.codes", { returnObjects: true }) as Record<string, string>)}
        />
      )}

      {id === "limits" && (
        <ComparisonTable
          headers={["Tier", "Limit"]}
          rows={Object.entries(t("apiReference.limits.tiers", { returnObjects: true }) as Record<string, string>)}
        />
      )}
    </div>
  );
}

function SDKDetail({ id, t }: { id: string; t: any }) {
  const idMap: Record<string, string> = {
    "js-sdk": "jsSDK",
    "go-sdk": "goSDK",
    "python-sdk": "pythonSDK",
    cli: "cli",
  };
  const key = idMap[id] || id;

  const titles: Record<string, string> = {
    "js-sdk": t("docs.items.js-sdk"),
    "go-sdk": t("docs.items.go-sdk"),
    "python-sdk": t("docs.items.python-sdk"),
    cli: t("docs.items.cli"),
  };

  const subtitle = t(`sdks.${key}.subtitle`, { defaultValue: "" });
  const install = t(`sdks.${key}.install`, { defaultValue: "" });
  const features = t(`sdks.${key}.features`, { returnObjects: true, defaultValue: [] });
  const methods = t(`sdks.${key}.methods`, { returnObjects: true, defaultValue: [] });
  const example = t(`sdks.${key}.example`, { defaultValue: "" });
  const commands = t(`sdks.${key}.commands`, { returnObjects: true, defaultValue: [] });

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-4xl font-black mb-8 tracking-tight">{titles[id]}</h1>
      <p className="text-lg text-slate-400">{subtitle}</p>

      <h2 className="text-2xl font-bold mt-12 mb-6">Installation</h2>
      <CodeBlock code={install} language="bash" />

      {Array.isArray(features) && features.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mt-12 mb-6">Features</h2>
          <div className="my-8 not-prose">
            <ul className="space-y-3">
              {features.map((feature: string, idx: number) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-neo/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={12} className="text-neo" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Methods Table */}
      {Array.isArray(methods) && methods.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mt-12 mb-6">Methods</h2>
          <div className="overflow-x-auto not-prose mb-10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5">
                  <th className="py-3 px-4 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Method</th>
                  <th className="py-3 px-4 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Parameters</th>
                  <th className="py-3 px-4 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Returns</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((method: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono text-sm text-neo">{method.name}</td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">{method.params}</td>
                    <td className="py-3 px-4 text-sm text-slate-400 font-mono text-xs">{method.returns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {Array.isArray(commands) && commands.length > 0 && (
        <>
          <h2 className="text-2xl font-bold mt-12 mb-6">Commands</h2>
          <div className="space-y-2 not-prose">
            {commands.map((cmd: string, idx: number) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-dark-900 border border-white/5 font-mono text-sm text-slate-300"
              >
                {cmd}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-2xl font-bold mt-12 mb-6">Example</h2>
      <CodeBlock
        code={example}
        language={id === "cli" ? "bash" : id.includes("go") ? "go" : id.includes("python") ? "python" : "javascript"}
      />
    </div>
  );
}

export const getServerSideProps = async () => ({ props: {} });
