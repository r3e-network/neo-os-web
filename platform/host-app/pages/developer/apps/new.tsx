/**
 * Create New App Page
 */

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";
import type { ChainId } from "@/lib/chains/types";
import { getChainRegistry } from "@/lib/chains/registry";

const categories = ["gaming", "defi", "social", "nft", "governance", "utility"] as const;

export default function CreateAppPage() {
  const router = useRouter();
  const { address } = useWalletStore();
  const [name, setName] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionZh, setDescriptionZh] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("utility");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Multi-chain configuration
  const [selectedChains, setSelectedChains] = useState<ChainId[]>(["neo-n3-mainnet"]);
  const [contractAddresses, setContractAddresses] = useState<Record<ChainId, string>>({});

  // Get available chains from registry
  const availableChains = useMemo(() => {
    const registry = getChainRegistry();
    return registry.getActiveChains();
  }, []);

  const toggleChain = (chainId: ChainId) => {
    setSelectedChains((prev) => (prev.includes(chainId) ? prev.filter((id) => id !== chainId) : [...prev, chainId]));
  };

  const updateContractAddress = (chainId: ChainId, address: string) => {
    setContractAddresses((prev) => ({ ...prev, [chainId]: address }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setSubmitting(true);
    setError("");

    try {
      if (!nameZh.trim() || !descriptionZh.trim()) {
        setError("Chinese name and description are required");
        setSubmitting(false);
        return;
      }
      // Build contracts JSON from selected chains
      const contractsJson: Record<string, { address: string }> = {};
      selectedChains.forEach((chainId) => {
        if (contractAddresses[chainId]) {
          contractsJson[chainId] = { address: contractAddresses[chainId] };
        }
      });

      const res = await fetch("/api/developer/apps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-developer-address": address,
        },
        body: JSON.stringify({
          name,
          name_zh: nameZh,
          description,
          description_zh: descriptionZh,
          category,
          supported_chains: selectedChains,
          contracts: Object.keys(contractsJson).length > 0 ? contractsJson : undefined,
        }),
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

          {/* Name (Chinese) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              App Name (Chinese) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nameZh}
              onChange={(e) => setNameZh(e.target.value)}
              placeholder="应用名称"
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

          {/* Description (Chinese) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (Chinese) <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={descriptionZh}
              onChange={(e) => setDescriptionZh(e.target.value)}
              placeholder="中文描述..."
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

          {/* Supported Chains */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Supported Chains <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">Select the blockchain networks your app supports</p>
            <div className="grid grid-cols-2 gap-3">
              {availableChains.map((chain) => (
                <button
                  key={chain.id}
                  type="button"
                  onClick={() => toggleChain(chain.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    selectedChains.includes(chain.id)
                      ? "border-neo bg-neo/10 text-neo"
                      : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                  }`}
                >
                  <img src={chain.icon} alt={chain.name} className="w-6 h-6 rounded-full" />
                  <span className="text-sm font-medium">{chain.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contract Addresses per Chain */}
          {selectedChains.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contract Addresses (Optional)
              </label>
              <p className="text-xs text-gray-500 mb-3">Enter contract addresses for each chain if applicable</p>
              <div className="space-y-3">
                {selectedChains.map((chainId) => {
                  const chain = availableChains.find((c) => c.id === chainId);
                  return (
                    <div key={chainId} className="flex items-center gap-3">
                      {chain && <img src={chain.icon} alt={chain.name} className="w-5 h-5 rounded-full" />}
                      <input
                        type="text"
                        value={contractAddresses[chainId] || ""}
                        onChange={(e) => updateContractAddress(chainId, e.target.value)}
                        placeholder={`Contract address on ${chain?.name || chainId}`}
                        className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-neo text-sm text-gray-900 dark:text-white"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
