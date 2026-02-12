/**
 * App Detail Page - Manage versions and settings
 */

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { VersionList, CreateVersionForm } from "@/components/features/developer";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";
import type { ChainId } from "@/lib/chains/types";
import { getChainRegistry } from "@/lib/chains/registry";
import { getWalletAuthHeaders } from "@/lib/security/wallet-auth-client";
import { logger } from "@/lib/logger";

interface App {
  app_id: string;
  name: string;
  name_zh?: string;
  description: string;
  description_zh?: string;
  category: string;
  status: string;
  visibility: string;
  supported_chains?: ChainId[];
  contracts?: Record<string, unknown>;
}

interface Version {
  id: string;
  version: string;
  version_code: number;
  status: string;
  is_current: boolean;
  release_notes?: string;
  created_at: string;
  published_at?: string;
}

export default function AppDetailPage() {
  const router = useRouter();
  const { appId } = router.query;
  const { address } = useWalletStore();

  const [app, setApp] = useState<App | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"versions" | "settings">("versions");

  useEffect(() => {
    if (!appId || !address) return;
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchData is stable, including it would cause infinite loop
  }, [appId, address]);

  const fetchData = async () => {
    try {
      const authHeaders = await getWalletAuthHeaders();

      const [appRes, versionsRes] = await Promise.all([
        fetch(`/api/developer/apps/${appId}`, { headers: authHeaders }),
        fetch(`/api/developer/apps/${appId}/versions`, { headers: authHeaders }),
      ]);

      const appData = await appRes.json();
      const versionsData = await versionsRes.json();

      setApp(appData.app);
      setVersions(versionsData.versions || []);
    } catch (err) {
      logger.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async (data: {
    version: string;
    release_notes: string;
    entry_url: string;
    build_url?: string;
  }) => {
    const authHeaders = await getWalletAuthHeaders();
    const res = await fetch(`/api/developer/apps/${appId}/versions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setShowCreateForm(false);
      fetchData();
    }
  };

  const handlePublish = async (versionId: string) => {
    const authHeaders = await getWalletAuthHeaders();
    await fetch(`/api/developer/apps/${appId}/versions/${versionId}/publish`, {
      method: "POST",
      headers: authHeaders,
    });
    fetchData();
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="h-8 w-48 bg-erobo-purple/10 dark:bg-white/10 rounded animate-pulse mb-4" />
          <div className="h-4 w-96 bg-erobo-purple/10 dark:bg-white/10 rounded animate-pulse" />
        </div>
      </Layout>
    );
  }

  if (!app) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <h2 className="text-2xl font-bold text-erobo-ink dark:text-white">App not found</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>{app.name} - Developer Dashboard</title>
      </Head>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/developer/dashboard"
          className="inline-flex items-center gap-2 text-erobo-ink-soft hover:text-erobo-ink dark:hover:text-white mb-6"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-erobo-ink dark:text-white">{app.name}</h1>
            <p className="text-erobo-ink-soft mt-1">{app.description}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-erobo-purple/10 dark:border-white/10 mb-6">
          <TabButton active={activeTab === "versions"} onClick={() => setActiveTab("versions")}>
            Versions
          </TabButton>
          <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")}>
            Settings
          </TabButton>
        </div>

        {/* Content */}
        {activeTab === "versions" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-erobo-ink dark:text-white">App Versions</h2>
              {!showCreateForm && (
                <Button onClick={() => setShowCreateForm(true)} className="bg-neo text-white">
                  <Plus size={16} className="mr-1" />
                  New Version
                </Button>
              )}
            </div>

            {showCreateForm && (
              <div className="mb-6">
                <CreateVersionForm
                  appId={app.app_id}
                  onSubmit={handleCreateVersion}
                  onCancel={() => setShowCreateForm(false)}
                />
              </div>
            )}

            <VersionList appId={app.app_id} versions={versions} onPublish={handlePublish} />
          </div>
        )}

        {activeTab === "settings" && <SettingsTab app={app} onUpdate={fetchData} />}
      </div>
    </Layout>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium border-b-2 transition-colors ${
        active
          ? "border-neo text-neo"
          : "border-transparent text-erobo-ink-soft hover:text-erobo-ink dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function SettingsTab({ app, onUpdate }: { app: App; onUpdate: () => void }) {
  const [name, setName] = useState(app.name);
  const [nameZh, setNameZh] = useState(app.name_zh || "");
  const [description, setDescription] = useState(app.description);
  const [descriptionZh, setDescriptionZh] = useState(app.description_zh || "");
  const [selectedChains, setSelectedChains] = useState<ChainId[]>(app.supported_chains || ["neo-n3-mainnet"]);
  const [contractAddresses, setContractAddresses] = useState<Record<string, string>>(
    (app.contracts as Record<string, string>) || {},
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(app.name);
    setNameZh(app.name_zh || "");
    setDescription(app.description);
    setDescriptionZh(app.description_zh || "");
  }, [app]);

  const availableChains = useMemo(() => {
    const registry = getChainRegistry();
    return registry.getActiveChains();
  }, []);

  const toggleChain = (chainId: ChainId) => {
    setSelectedChains((prev) => (prev.includes(chainId) ? prev.filter((id) => id !== chainId) : [...prev, chainId]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const authHeaders = await getWalletAuthHeaders();
      await fetch(`/api/developer/apps/${app.app_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          name,
          name_zh: nameZh,
          description,
          description_zh: descriptionZh,
          supported_chains: selectedChains,
          contracts: contractAddresses,
        }),
      });
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* App Metadata */}
      <div className="rounded-2xl p-6 bg-white dark:bg-[#080808] border border-erobo-purple/10 dark:border-white/10">
        <h3 className="font-bold text-erobo-ink dark:text-white mb-4">App Metadata</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">App Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 text-erobo-ink dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
              App Name (Chinese)
            </label>
            <input
              type="text"
              value={nameZh}
              onChange={(e) => setNameZh(e.target.value)}
              placeholder="应用名称"
              className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 text-erobo-ink dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 text-erobo-ink dark:text-white resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-erobo-ink dark:text-slate-300 mb-2">
              Description (Chinese)
            </label>
            <textarea
              rows={3}
              value={descriptionZh}
              onChange={(e) => setDescriptionZh(e.target.value)}
              placeholder="中文描述..."
              className="w-full px-4 py-3 rounded-xl bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 text-erobo-ink dark:text-white resize-none"
            />
          </div>
        </div>
      </div>

      {/* Chain Configuration */}
      <div className="rounded-2xl p-6 bg-white dark:bg-[#080808] border border-erobo-purple/10 dark:border-white/10">
        <h3 className="font-bold text-erobo-ink dark:text-white mb-4">Supported Chains</h3>
        <p className="text-erobo-ink-soft text-sm mb-4">Select the blockchain networks your app supports</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {availableChains.map((chain) => (
            <button
              key={chain.id}
              type="button"
              onClick={() => toggleChain(chain.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                selectedChains.includes(chain.id)
                  ? "border-neo bg-neo/10 text-neo"
                  : "border-erobo-purple/10 dark:border-white/10 hover:border-erobo-purple/20"
              }`}
            >
              <img src={chain.icon} alt={chain.name} className="w-6 h-6 rounded-full" />
              <span className="text-sm font-medium">{chain.name}</span>
            </button>
          ))}
        </div>

        {/* Contract Addresses */}
        <h4 className="font-medium text-erobo-ink dark:text-white mb-3">Contract Addresses</h4>
        <div className="space-y-3 mb-4">
          {selectedChains.map((chainId) => {
            const chain = availableChains.find((c) => c.id === chainId);
            return (
              <div key={chainId} className="flex items-center gap-3">
                {chain && <img src={chain.icon} alt={chain.name} className="w-5 h-5 rounded-full" />}
                <input
                  type="text"
                  value={contractAddresses[chainId] || ""}
                  onChange={(e) => setContractAddresses((prev) => ({ ...prev, [chainId]: e.target.value }))}
                  placeholder={`Contract on ${chain?.name || chainId}`}
                  className="flex-1 px-3 py-2 rounded-lg bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 text-sm"
                />
              </div>
            );
          })}
        </div>

        <Button onClick={handleSave} disabled={saving} className="bg-neo text-white">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl p-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
        <h3 className="font-bold text-red-700 dark:text-red-400 mb-2">Danger Zone</h3>
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">
          Deleting your app is permanent and cannot be undone.
        </p>
        <Button variant="ghost" className="text-red-600 border-red-300 hover:bg-red-100">
          <Trash2 size={16} className="mr-2" />
          Delete App
        </Button>
      </div>
    </div>
  );
}
