import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { X, Code2, Rocket, Shield, Dice5, TrendingUp, ChevronRight, ExternalLink, LayoutDashboard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n/react";
import { getWalletAuthHeaders } from "@/lib/security/wallet-auth-client";

const categories = ["gaming", "defi", "social", "nft", "governance", "utility"] as const;

type FormData = {
  name: string;
  name_zh: string;
  description: string;
  description_zh: string;
  icon: string;
  category: (typeof categories)[number];
  entry_url: string;
  build_url: string;
  supported_chains: string;
  contracts_json: string;
  developer_name: string;
  developer_address: string;
};

const initialForm: FormData = {
  name: "",
  name_zh: "",
  description: "",
  description_zh: "",
  icon: "📦",
  category: "utility",
  entry_url: "",
  build_url: "",
  supported_chains: "",
  contracts_json: "",
  developer_name: "",
  developer_address: "",
};

export default function DeveloperPage() {
  const { t } = useTranslation("host");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const features = [
    {
      icon: Code2,
      title: t("developer.features.sdk"),
      desc: t("developer.features.sdkDesc"),
      color: "from-erobo-purple to-erobo-sky",
    },
    {
      icon: Shield,
      title: t("developer.features.tee"),
      desc: t("developer.features.teeDesc"),
      color: "from-erobo-pink to-erobo-purple",
    },
    {
      icon: Dice5,
      title: t("developer.features.vrf"),
      desc: t("developer.features.vrfDesc"),
      color: "from-neo to-erobo-mint",
    },
    {
      icon: TrendingUp,
      title: t("developer.features.oracles"),
      desc: t("developer.features.oraclesDesc"),
      color: "from-erobo-peach to-erobo-pink",
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const supportedChains = form.supported_chains
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
      let contracts: Record<string, { address?: string | null; active?: boolean; entry_url?: string }> | undefined;
      if (form.contracts_json.trim()) {
        try {
          const parsed = JSON.parse(form.contracts_json);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("invalid contracts");
          }
          contracts = parsed;
        } catch {
          setResult({ success: false, message: t("developer.form.contractsJsonInvalid") });
          setSubmitting(false);
          return;
        }
      }

      const authHeaders = await getWalletAuthHeaders();
      const res = await fetch("/api/miniapps/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          ...form,
          build_url: form.build_url.trim() || undefined,
          supported_chains: supportedChains,
          contracts,
          permissions: { payments: true, rng: true, datafeed: true },
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: t("developer.form.success").replace("{name}", form.name) });
        setForm(initialForm);
        setTimeout(() => setShowForm(false), 2000);
      } else {
        setResult({ success: false, message: data.error || t("developer.form.error") });
      }
    } catch {
      setResult({ success: false, message: t("developer.form.networkError") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Developer Portal - Neo MiniApp Platform</title>
        <meta
          name="description"
          content="Build decentralized MiniApps on Neo N3. Access SDK tools, TEE security, VRF random numbers, oracle data feeds, and submit your app to the NeoHub marketplace."
        />
        <meta property="og:title" content="Developer Portal - Neo MiniApp Platform" />
        <meta
          property="og:description"
          content="Build decentralized MiniApps on Neo N3. Access SDK tools, TEE security, VRF random numbers, oracle data feeds, and submit your app to the NeoHub marketplace."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://miniapp.neo.org/developer" />
        <meta property="og:image" content="https://miniapp.neo.org/og-image.png" />
        <meta property="og:site_name" content="NeoHub" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Developer Portal - Neo MiniApp Platform" />
        <meta
          name="twitter:description"
          content="Build decentralized MiniApps on Neo N3 with SDK tools, TEE security, and oracle data feeds."
        />
      </Head>

      {/* Hero Section */}
      <section className="bg-white dark:bg-erobo-bg-deeper border-b border-erobo-purple/10 dark:border-white/10 py-20 relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-neo/20 to-transparent rounded-full blur-[120px] pointer-events-none -mr-48 -mt-48 opacity-60" />

        <div className="mx-auto max-w-7xl px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neo/10 border border-neo/20 text-neo text-sm font-medium mb-6">
              <Rocket size={16} strokeWidth={2} />
              {t("developer.badge")}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-erobo-ink dark:text-white leading-tight">
              {t("developer.title")}
            </h1>
            <p className="mt-6 text-lg text-erobo-ink-soft dark:text-slate-400 max-w-2xl mx-auto">
              {t("developer.subtitle")}
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link href="/developer/dashboard">
                <Button size="lg" className="bg-neo text-white rounded-xl hover:bg-neo/90 transition-all font-medium">
                  <LayoutDashboard size={18} className="mr-2" />
                  My Dashboard
                </Button>
              </Link>
              <Link href="/docs">
                <Button
                  size="lg"
                  className="bg-erobo-bg-dark dark:bg-white text-white dark:text-erobo-ink rounded-xl hover:bg-erobo-bg-card dark:hover:bg-erobo-purple/10 transition-all font-medium"
                >
                  {t("developer.readDocumentation")}
                </Button>
              </Link>
              <Button
                size="lg"
                className="bg-white dark:bg-white/5 text-erobo-ink dark:text-white border border-erobo-purple/10 dark:border-white/10 rounded-xl hover:bg-neo/10 hover:text-neo hover:border-neo/20 transition-all font-medium"
                onClick={() => setShowForm(true)}
              >
                {t("developer.submitMiniApp")}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Start & Submit Cards */}
      <section className="py-24 px-4 bg-erobo-purple/5 dark:bg-[#050505]">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Quick Start Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl p-10 bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-erobo-purple/10 dark:border-white/10 shadow-lg hover:-translate-y-1 hover:shadow-xl hover:border-neo/40 transition-all"
            >
              <div className="flex items-center gap-6 mb-8">
                <div className="w-16 h-16 rounded-xl bg-neo/10 border border-neo/20 flex items-center justify-center">
                  <Code2 className="text-neo" size={32} strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-erobo-ink dark:text-white">{t("developer.quickStart")}</h2>
                  <p className="text-erobo-ink-soft dark:text-slate-400 text-sm">{t("developer.quickStartDesc")}</p>
                </div>
              </div>
              <div className="rounded-xl bg-erobo-bg-dark dark:bg-black border border-erobo-purple/10 dark:border-white/10 p-6 font-mono text-sm overflow-x-auto mb-6">
                <div className="text-erobo-ink-soft">// {t("developer.installSdkComment")}</div>
                <div className="text-neo">$ npm install @meshminiapp/sdk</div>
                <div className="text-erobo-ink-soft mt-4">// {t("developer.createAppComment")}</div>
                <div className="text-neo">$ npx create-miniapp my-app</div>
              </div>
              <Link href="/docs">
                <Button className="w-full bg-erobo-bg-dark dark:bg-white text-white dark:text-erobo-ink rounded-xl font-medium hover:bg-erobo-bg-card dark:hover:bg-erobo-purple/10 transition-all">
                  {t("developer.readDocumentation")}
                  <ChevronRight size={16} className="ml-2" />
                </Button>
              </Link>
            </motion.div>

            {/* Submit Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-2xl p-10 bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-erobo-purple/10 dark:border-white/10 shadow-lg hover:-translate-y-1 hover:shadow-xl hover:border-neo/40 transition-all"
            >
              <div className="flex items-center gap-6 mb-8">
                <div className="w-16 h-16 rounded-xl bg-erobo-purple/10 border border-erobo-purple/20 flex items-center justify-center">
                  <Rocket className="text-erobo-purple" size={32} strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-erobo-ink dark:text-white">{t("developer.submitYourApp")}</h2>
                  <p className="text-erobo-ink-soft dark:text-slate-400 text-sm">{t("developer.submitYourAppDesc")}</p>
                </div>
              </div>
              <p className="text-erobo-ink dark:text-white font-medium mb-6">{t("developer.readyToLaunch")}</p>
              <ul className="space-y-3 mb-8">
                {[
                  t("developer.reviewSteps.securityReview"),
                  t("developer.reviewSteps.performanceTesting"),
                  t("developer.reviewSteps.marketplaceListing"),
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-erobo-ink-soft/80 dark:text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-neo" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => setShowForm(true)}
                className="w-full bg-neo text-white rounded-xl font-medium hover:bg-neo/90 transition-all"
              >
                {t("developer.submitMiniApp")}
                <ExternalLink size={16} className="ml-2" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-erobo-ink dark:text-white">{t("developer.platformFeatures")}</h2>
            <p className="mt-4 text-erobo-ink-soft/80 dark:text-slate-400 max-w-2xl mx-auto">
              Everything you need to build powerful decentralized applications
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            {features.map((f, idx) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * idx }}
                className="group rounded-2xl p-6 bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-erobo-purple/10 dark:border-white/10 shadow-lg hover:shadow-xl hover:-translate-y-1 hover:border-neo/40 transition-all"
              >
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-6 group-hover:scale-105 transition-transform`}
                >
                  <f.icon className="text-white" size={28} strokeWidth={2} />
                </div>
                <h3 className="font-bold text-lg text-erobo-ink dark:text-white mb-2">{f.title}</h3>
                <p className="text-sm text-erobo-ink-soft dark:text-slate-400">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SDK Examples Section */}
      <section className="py-20 px-4 bg-erobo-purple/5 dark:bg-[#050505]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-erobo-ink dark:text-white">SDK Examples</h2>
            <p className="mt-4 text-erobo-ink-soft/80 dark:text-slate-400 max-w-2xl mx-auto">
              Get started quickly with these code examples
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Wallet Integration */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl bg-white dark:bg-[#080808]/80 border border-erobo-purple/10 dark:border-white/10 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-erobo-purple/10 dark:border-white/10 bg-erobo-purple/5 dark:bg-white/5">
                <h3 className="font-bold text-erobo-ink dark:text-white">Wallet Integration</h3>
                <p className="text-sm text-erobo-ink-soft dark:text-slate-400">
                  Connect and interact with user wallets
                </p>
              </div>
              <div className="p-6">
                <pre className="rounded-xl bg-erobo-bg-dark dark:bg-black p-4 overflow-x-auto text-sm">
                  <code className="text-slate-300 font-mono">{`import { waitForSDK } from "@r3e/uniapp-sdk";

// Initialize SDK
const sdk = await waitForSDK();

// Get wallet address
const address = await sdk.wallet.getAddress();

// Request payment
const result = await sdk.wallet.requestPayment({
  to: "NX...",
  amount: "10",
  asset: "GAS"
});`}</code>
                </pre>
              </div>
            </motion.div>

            {/* VRF Random Numbers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl bg-white dark:bg-[#080808]/80 border border-erobo-purple/10 dark:border-white/10 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-erobo-purple/10 dark:border-white/10 bg-erobo-purple/5 dark:bg-white/5">
                <h3 className="font-bold text-erobo-ink dark:text-white">VRF Random Numbers</h3>
                <p className="text-sm text-erobo-ink-soft dark:text-slate-400">Generate verifiable random numbers</p>
              </div>
              <div className="p-6">
                <pre className="rounded-xl bg-erobo-bg-dark dark:bg-black p-4 overflow-x-auto text-sm">
                  <code className="text-slate-300 font-mono">{`// Request random number
const random = await sdk.vrf.requestRandom({
  min: 1,
  max: 100,
  count: 1
});

console.log("Random:", random.values[0]);
console.log("Proof:", random.proof);`}</code>
                </pre>
              </div>
            </motion.div>

            {/* Oracle Data Feeds */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-2xl bg-white dark:bg-[#080808]/80 border border-erobo-purple/10 dark:border-white/10 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-erobo-purple/10 dark:border-white/10 bg-erobo-purple/5 dark:bg-white/5">
                <h3 className="font-bold text-erobo-ink dark:text-white">Oracle Data Feeds</h3>
                <p className="text-sm text-erobo-ink-soft dark:text-slate-400">Access real-time price data</p>
              </div>
              <div className="p-6">
                <pre className="rounded-xl bg-erobo-bg-dark dark:bg-black p-4 overflow-x-auto text-sm">
                  <code className="text-slate-300 font-mono">{`// Get price feed
const price = await sdk.oracle.getPrice({
  pair: "NEO/USD",
  source: "aggregated"
});

console.log("Price:", price.value);
console.log("Updated:", price.timestamp);`}</code>
                </pre>
              </div>
            </motion.div>

            {/* TEE Secrets */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="rounded-2xl bg-white dark:bg-[#080808]/80 border border-erobo-purple/10 dark:border-white/10 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-erobo-purple/10 dark:border-white/10 bg-erobo-purple/5 dark:bg-white/5">
                <h3 className="font-bold text-erobo-ink dark:text-white">TEE Secrets</h3>
                <p className="text-sm text-erobo-ink-soft dark:text-slate-400">Secure secret management</p>
              </div>
              <div className="p-6">
                <pre className="rounded-xl bg-erobo-bg-dark dark:bg-black p-4 overflow-x-auto text-sm">
                  <code className="text-slate-300 font-mono">{`// Store secret in TEE
await sdk.secrets.set({
  key: "api_key",
  value: "sk_live_xxx",
  encrypted: true
});

// Retrieve secret
const secret = await sdk.secrets.get("api_key");`}</code>
                </pre>
              </div>
            </motion.div>
          </div>

          <div className="mt-10 text-center">
            <Link href="/docs?section=js-sdk">
              <Button className="bg-neo text-white rounded-xl font-medium hover:bg-neo/90 transition-all">
                View Full SDK Documentation
                <ChevronRight size={16} className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* API Reference Quick Links */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-erobo-ink dark:text-white">API Reference</h2>
            <p className="mt-4 text-erobo-ink-soft/80 dark:text-slate-400 max-w-2xl mx-auto">
              Comprehensive API documentation for all platform services
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {[
              { name: "REST API", desc: "HTTP endpoints", href: "/docs?section=rest-api", icon: "🌐" },
              { name: "WebSocket", desc: "Real-time events", href: "/docs?section=websocket", icon: "⚡" },
              { name: "VRF Service", desc: "Random numbers", href: "/docs?section=vrf", icon: "🎲" },
              { name: "Oracle", desc: "Price feeds", href: "/docs?section=oracle", icon: "📊" },
              { name: "Secrets", desc: "TEE storage", href: "/docs?section=secrets", icon: "🔐" },
              { name: "GasBank", desc: "Gas sponsorship", href: "/docs?section=gasbank", icon: "⛽" },
              { name: "Automation", desc: "Scheduled tasks", href: "/docs?section=automation", icon: "🤖" },
              { name: "Error Codes", desc: "Error handling", href: "/docs?section=errors", icon: "⚠️" },
            ].map((api, idx) => (
              <Link key={api.name} href={api.href}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="p-4 rounded-xl bg-white dark:bg-[#080808]/80 border border-erobo-purple/10 dark:border-white/10 hover:border-neo/40 hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{api.icon}</span>
                    <div>
                      <h4 className="font-bold text-erobo-ink dark:text-white group-hover:text-neo transition-colors">
                        {api.name}
                      </h4>
                      <p className="text-xs text-erobo-ink-soft dark:text-slate-400">{api.desc}</p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Result Notification */}
      <AnimatePresence>
        {result && !showForm && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <div
              className={`rounded-xl p-4 shadow-2xl backdrop-blur-xl ${
                result.success
                  ? "bg-green-500/20 border border-green-500/30 text-green-400"
                  : "bg-red-500/20 border border-red-500/30 text-red-400"
              }`}
            >
              {result.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-in Panel */}
      <AnimatePresence>
        {showForm && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-[#080808] border-l border-erobo-purple/10 dark:border-white/10 shadow-2xl overflow-y-auto"
            >
              {/* Panel Header */}
              <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#080808]/95 backdrop-blur-xl border-b border-erobo-purple/10 dark:border-white/10 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-erobo-ink dark:text-white">{t("developer.form.title")}</h2>
                    <p className="text-sm text-erobo-ink-soft dark:text-slate-400">{t("developer.form.subtitle")}</p>
                  </div>
                  <button
                    onClick={() => setShowForm(false)}
                    className="p-2 rounded-lg border border-erobo-purple/10 dark:border-white/10 hover:bg-erobo-purple/10 dark:hover:bg-white/10 transition-all"
                  >
                    <X className="text-erobo-ink-soft dark:text-slate-400" size={20} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* App Name */}
                <div>
                  <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
                    {t("developer.form.appName")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t("developer.form.appNamePlaceholder")}
                    className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo transition-all text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
                    {t("developer.form.description")} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder={t("developer.form.descriptionPlaceholder")}
                    className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo transition-all text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50 resize-none"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                {/* Chinese Metadata (Required) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
                      {t("developer.form.appNameZh")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t("developer.form.appNameZhPlaceholder")}
                      className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo transition-all text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50"
                      value={form.name_zh}
                      onChange={(e) => setForm({ ...form, name_zh: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
                      {t("developer.form.descriptionZh")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t("developer.form.descriptionZhPlaceholder")}
                      className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo transition-all text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50"
                      value={form.description_zh}
                      onChange={(e) => setForm({ ...form, description_zh: e.target.value })}
                    />
                  </div>
                </div>

                {/* Icon & Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
                      {t("developer.form.icon")}
                    </label>
                    <input
                      type="text"
                      placeholder={t("developer.form.iconPlaceholder")}
                      className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo transition-all text-erobo-ink dark:text-white text-center text-2xl placeholder-erobo-ink-soft/50"
                      value={form.icon}
                      onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
                      {t("developer.form.category")}
                    </label>
                    <div className="relative">
                      <select
                        className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo transition-all appearance-none cursor-pointer text-erobo-ink dark:text-white"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value as FormData["category"] })}
                      >
                        {categories.map((c) => (
                          <option key={c} value={c} className="bg-white dark:bg-black text-black dark:text-white">
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-erobo-ink-soft dark:text-slate-400">
                        ▼
                      </div>
                    </div>
                  </div>
                </div>

                {/* Entry URL */}
                <div>
                  <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
                    {t("developer.form.entryUrl")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder={t("developer.form.entryUrlPlaceholder")}
                    className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo transition-all text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50"
                    value={form.entry_url}
                    onChange={(e) => setForm({ ...form, entry_url: e.target.value })}
                  />
                </div>

                {/* Build Artifact URL */}
                <div>
                  <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
                    {t("developer.form.buildUrl")}
                  </label>
                  <input
                    type="url"
                    placeholder={t("developer.form.buildUrlPlaceholder")}
                    className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo transition-all text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50"
                    value={form.build_url}
                    onChange={(e) => setForm({ ...form, build_url: e.target.value })}
                  />
                  <p className="mt-2 text-xs text-erobo-ink-soft">{t("developer.form.buildUrlHelp")}</p>
                </div>

                {/* Supported Chains */}
                <div>
                  <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
                    {t("developer.form.supportedChains")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("developer.form.supportedChainsPlaceholder")}
                    className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo transition-all text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50"
                    value={form.supported_chains}
                    onChange={(e) => setForm({ ...form, supported_chains: e.target.value })}
                  />
                </div>

                {/* Contracts JSON */}
                <div>
                  <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
                    {t("developer.form.contractsJson")}
                  </label>
                  <textarea
                    rows={4}
                    placeholder={t("developer.form.contractsJsonPlaceholder")}
                    className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo transition-all font-mono text-sm text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50"
                    value={form.contracts_json}
                    onChange={(e) => setForm({ ...form, contracts_json: e.target.value })}
                  />
                </div>

                {/* Developer Info */}
                <div className="pt-4 border-t border-erobo-purple/10 dark:border-white/10">
                  <h3 className="text-sm font-medium text-erobo-ink dark:text-slate-300 mb-4">
                    {t("developer.form.developerInfo")}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
                        {t("developer.form.developerName")}
                      </label>
                      <input
                        type="text"
                        placeholder={t("developer.form.developerNamePlaceholder")}
                        className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo transition-all text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50"
                        value={form.developer_name}
                        onChange={(e) => setForm({ ...form, developer_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
                        {t("developer.form.neoAddress")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={t("developer.form.neoAddressPlaceholder")}
                        className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo transition-all font-mono text-sm text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50"
                        value={form.developer_address}
                        onChange={(e) => setForm({ ...form, developer_address: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Result in panel */}
                {result && (
                  <div
                    className={`rounded-xl p-4 ${
                      result.success
                        ? "bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400"
                        : "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {result.message}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowForm(false)}
                    className="flex-1 border border-erobo-purple/10 dark:border-white/10 text-erobo-ink dark:text-slate-300 rounded-xl hover:bg-erobo-purple/10 dark:hover:bg-white/10 font-medium transition-all"
                  >
                    {t("developer.form.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-neo text-white rounded-xl hover:bg-neo/90 font-medium transition-all"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t("developer.form.submitting")}
                      </span>
                    ) : (
                      t("developer.form.submit")
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Layout>
  );
}
