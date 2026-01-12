/**
 * Create New App Page
 */

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";

const categories = ["gaming", "defi", "social", "nft", "governance", "utility"] as const;

export default function CreateAppPage() {
  const router = useRouter();
  const { address } = useWalletStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("utility");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/developer/apps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-developer-address": address,
        },
        body: JSON.stringify({ name, description, category }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push(`/developer/apps/${data.app.app_id}`);
      } else {
        setError(data.error || "Failed to create app");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Create New App - NeoHub</title>
      </Head>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/developer/dashboard"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create New App</h1>
        <p className="text-gray-500 mb-8">Fill in the details to create your MiniApp</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              App Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome App"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo text-gray-900 dark:text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what your app does..."
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-neo text-gray-900 dark:text-white"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Link href="/developer/dashboard" className="flex-1">
              <Button type="button" variant="ghost" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={submitting} className="flex-1 bg-neo text-white hover:bg-neo/90">
              {submitting ? "Creating..." : "Create App"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

export const getServerSideProps = async () => ({ props: {} });
