import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { X, Code2, Rocket, Shield, Dice5, TrendingUp, ChevronRight, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n/react";

const categories = ["gaming", "defi", "social", "nft", "governance", "utility"] as const;

type FormData = {
  name: string;
  description: string;
  icon: string;
  category: (typeof categories)[number];
  entry_url: string;
  contract_hash: string;
  developer_name: string;
  developer_address: string;
};

const initialForm: FormData = {
  name: "",
  description: "",
  icon: "📦",
  category: "utility",
  entry_url: "",
  contract_hash: "",
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
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: Shield,
      title: t("developer.features.tee"),
      desc: t("developer.features.teeDesc"),
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: Dice5,
      title: t("developer.features.vrf"),
      desc: t("developer.features.vrfDesc"),
      color: "from-green-500 to-emerald-500",
    },
    {
      icon: TrendingUp,
      title: t("developer.features.oracles"),
      desc: t("developer.features.oraclesDesc"),
      color: "from-orange-500 to-yellow-500",
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/miniapps/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          permissions: { payments: true, randomness: true, datafeed: true },
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
      </Head>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-medium mb-6">
              <Rocket size={16} />
              {t("developer.badge")}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold">{t("developer.title")}</h1>
            <p className="mt-6 text-lg text-primary-100 max-w-2xl mx-auto">{t("developer.subtitle")}</p>
            <div className="mt-8 flex justify-center gap-4">
              <Link href="/docs">
                <Button size="lg" className="bg-white text-primary-700 hover:bg-gray-100 font-semibold">
                  {t("developer.readDocumentation")}
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10"
                onClick={() => setShowForm(true)}
              >
                {t("developer.submitMiniApp")}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Start & Submit Cards */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Quick Start Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <Code2 className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("developer.quickStart")}</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{t("developer.quickStartDesc")}</p>
                </div>
              </div>
              <div className="rounded-xl bg-gray-900 p-4 font-mono text-sm overflow-x-auto">
                <div className="text-gray-500">{t("developer.installSdkComment")}</div>
                <div className="text-primary-400">npm install @neo-miniapp/sdk</div>
                <div className="text-gray-500 mt-3">{t("developer.createAppComment")}</div>
                <div className="text-primary-400">npx create-miniapp my-app</div>
              </div>
              <Link href="/docs">
                <Button className="mt-6 bg-primary-600 hover:bg-primary-700 text-white font-semibold">
                  {t("developer.readDocumentation")}
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </Link>
            </motion.div>

            {/* Submit Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-2xl p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <Rocket className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("developer.submitYourApp")}</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{t("developer.submitYourAppDesc")}</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{t("developer.readyToLaunch")}</p>
              <ul className="space-y-2 mb-6">
                {[
                  t("developer.reviewSteps.securityReview"),
                  t("developer.reviewSteps.performanceTesting"),
                  t("developer.reviewSteps.marketplaceListing"),
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold"
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
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{t("developer.platformFeatures")}</h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
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
                className="group rounded-xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <f.icon className="text-white" size={24} />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{f.desc}</p>
              </motion.div>
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
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl overflow-y-auto"
            >
              {/* Panel Header */}
              <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("developer.form.title")}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("developer.form.subtitle")}</p>
                  </div>
                  <button
                    onClick={() => setShowForm(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <X className="text-gray-500 dark:text-gray-400" size={20} />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* App Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t("developer.form.appName")} <span className="text-red-500">{t("developer.form.required")}</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t("developer.form.appNamePlaceholder")}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t("developer.form.description")}{" "}
                    <span className="text-red-500">{t("developer.form.required")}</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder={t("developer.form.descriptionPlaceholder")}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all resize-none"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                {/* Icon & Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t("developer.form.icon")}
                    </label>
                    <input
                      type="text"
                      placeholder={t("developer.form.iconPlaceholder")}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-center text-2xl placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                      value={form.icon}
                      onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t("developer.form.category")}
                    </label>
                    <select
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all appearance-none cursor-pointer"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value as FormData["category"] })}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c} className="bg-white dark:bg-gray-800">
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Entry URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t("developer.form.entryUrl")} <span className="text-red-500">{t("developer.form.required")}</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder={t("developer.form.entryUrlPlaceholder")}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                    value={form.entry_url}
                    onChange={(e) => setForm({ ...form, entry_url: e.target.value })}
                  />
                </div>

                {/* Contract Hash */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t("developer.form.contractHash")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("developer.form.contractHashPlaceholder")}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all font-mono text-sm"
                    value={form.contract_hash}
                    onChange={(e) => setForm({ ...form, contract_hash: e.target.value })}
                  />
                </div>

                {/* Developer Info */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                    {t("developer.form.developerInfo")}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t("developer.form.developerName")}
                      </label>
                      <input
                        type="text"
                        placeholder={t("developer.form.developerNamePlaceholder")}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                        value={form.developer_name}
                        onChange={(e) => setForm({ ...form, developer_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t("developer.form.neoAddress")}{" "}
                        <span className="text-red-500">{t("developer.form.required")}</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={t("developer.form.neoAddressPlaceholder")}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all font-mono text-sm"
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
                        ? "bg-green-500/20 border border-green-500/30 text-green-400"
                        : "bg-red-500/20 border border-red-500/30 text-red-400"
                    }`}
                  >
                    {result.message}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    {t("developer.form.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold"
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

export const getServerSideProps = async () => ({ props: {} });
