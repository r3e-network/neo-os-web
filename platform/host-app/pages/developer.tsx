import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { X, Code2, Rocket, Shield, Dice5, TrendingUp, ChevronRight, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const features = [
  { icon: Code2, title: "SDK", desc: "TypeScript SDK for building MiniApps", color: "from-blue-500 to-cyan-500" },
  { icon: Shield, title: "TEE", desc: "Confidential computing support", color: "from-purple-500 to-pink-500" },
  { icon: Dice5, title: "VRF", desc: "Verifiable random functions", color: "from-green-500 to-emerald-500" },
  { icon: TrendingUp, title: "Oracles", desc: "Real-time price feeds", color: "from-orange-500 to-yellow-500" },
];

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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

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
        setResult({ success: true, message: `MiniApp "${form.name}" submitted for review!` });
        setForm(initialForm);
        setTimeout(() => setShowForm(false), 2000);
      } else {
        setResult({ success: false, message: data.error || "Submission failed" });
      }
    } catch {
      setResult({ success: false, message: "Network error" });
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
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-neo/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 blur-[120px] rounded-full" />
        </div>

        <div className="mx-auto max-w-7xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neo/10 border border-neo/20 text-neo text-sm font-medium mb-6">
              <Rocket size={16} />
              Build on Neo N3
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white">
              Developer <span className="neo-gradient-text">Portal</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Build, test, and publish MiniApps with our powerful SDK. Access TEE, VRF, and Oracle services out of the
              box.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Quick Start & Submit Cards */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Quick Start Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass-card rounded-2xl p-8 bg-gray-900/50 dark:bg-gray-900/50"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neo to-emerald-600 flex items-center justify-center">
                  <Code2 className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Quick Start</h2>
                  <p className="text-gray-400 text-sm">Get up and running in minutes</p>
                </div>
              </div>
              <div className="rounded-xl bg-black/50 p-4 font-mono text-sm overflow-x-auto">
                <div className="text-gray-500"># Install the SDK</div>
                <div className="text-neo">npm install @neo-miniapp/sdk</div>
                <div className="text-gray-500 mt-3"># Create your first app</div>
                <div className="text-neo">npx create-miniapp my-app</div>
              </div>
              <Link href="/docs">
                <Button className="mt-6 bg-neo hover:bg-neo/90 text-gray-900 font-semibold">
                  Read Documentation
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </Link>
            </motion.div>

            {/* Submit Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="glass-card rounded-2xl p-8 bg-gray-900/50 dark:bg-gray-900/50"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <Rocket className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Submit Your App</h2>
                  <p className="text-gray-400 text-sm">Publish to the marketplace</p>
                </div>
              </div>
              <p className="text-gray-400 mb-6">
                Ready to launch? Submit your MiniApp for review and reach thousands of Neo users.
              </p>
              <ul className="space-y-2 mb-6">
                {["Automated security review", "Performance testing", "Listing in marketplace"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-neo" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold"
              >
                Submit MiniApp
                <ExternalLink size={16} className="ml-2" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Platform Features</h2>
          <div className="grid gap-4 md:grid-cols-4">
            {features.map((f, idx) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * idx }}
                className="group glass-card rounded-xl p-6 bg-gray-900/30 dark:bg-gray-900/30 hover:bg-gray-900/50 transition-all cursor-pointer"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <f.icon className="text-white" size={24} />
                </div>
                <h3 className="font-bold text-white mb-1">{f.title}</h3>
                <p className="text-sm text-gray-400">{f.desc}</p>
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
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-gray-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl overflow-y-auto"
            >
              {/* Panel Header */}
              <div className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-xl border-b border-white/10 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Submit MiniApp</h2>
                    <p className="text-sm text-gray-400">Fill in your app details</p>
                  </div>
                  <button
                    onClick={() => setShowForm(false)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="text-gray-400" size={20} />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* App Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    App Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="My Awesome MiniApp"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neo/50 focus:ring-1 focus:ring-neo/50 transition-all"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe what your app does..."
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neo/50 focus:ring-1 focus:ring-neo/50 transition-all resize-none"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                {/* Icon & Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Icon (emoji)</label>
                    <input
                      type="text"
                      placeholder="📦"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl placeholder-gray-500 focus:outline-none focus:border-neo/50 focus:ring-1 focus:ring-neo/50 transition-all"
                      value={form.icon}
                      onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                    <select
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-neo/50 focus:ring-1 focus:ring-neo/50 transition-all appearance-none cursor-pointer"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value as FormData["category"] })}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c} className="bg-gray-900">
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Entry URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Entry URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://your-app.com/miniapp"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neo/50 focus:ring-1 focus:ring-neo/50 transition-all"
                    value={form.entry_url}
                    onChange={(e) => setForm({ ...form, entry_url: e.target.value })}
                  />
                </div>

                {/* Contract Hash */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Contract Hash</label>
                  <input
                    type="text"
                    placeholder="0x... (optional)"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neo/50 focus:ring-1 focus:ring-neo/50 transition-all font-mono text-sm"
                    value={form.contract_hash}
                    onChange={(e) => setForm({ ...form, contract_hash: e.target.value })}
                  />
                </div>

                {/* Developer Info */}
                <div className="pt-4 border-t border-white/10">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4">Developer Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Developer Name</label>
                      <input
                        type="text"
                        placeholder="Your name or team"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neo/50 focus:ring-1 focus:ring-neo/50 transition-all"
                        value={form.developer_name}
                        onChange={(e) => setForm({ ...form, developer_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Neo Address <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="NXxx..."
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-neo/50 focus:ring-1 focus:ring-neo/50 transition-all font-mono text-sm"
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
                    className="flex-1 border-white/20 text-gray-300 hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-neo to-emerald-600 hover:from-neo/90 hover:to-emerald-600/90 text-gray-900 font-semibold"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
                        Submitting...
                      </span>
                    ) : (
                      "Submit for Review"
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
