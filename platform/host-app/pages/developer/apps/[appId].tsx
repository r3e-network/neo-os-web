/**
 * App Detail Page - Manage versions and settings
 */

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { VersionList, CreateVersionForm } from "@/components/features/developer";
import { ArrowLeft, Plus, Settings, Trash2 } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";

interface App {
  app_id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  visibility: string;
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
    fetchData();
  }, [appId, address]);

  const fetchData = async () => {
    try {
      const headers = { "x-developer-address": address || "" };

      const [appRes, versionsRes] = await Promise.all([
        fetch(`/api/developer/apps/${appId}`, { headers }),
        fetch(`/api/developer/apps/${appId}/versions`, { headers }),
      ]);

      const appData = await appRes.json();
      const versionsData = await versionsRes.json();

      setApp(appData.app);
      setVersions(versionsData.versions || []);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async (data: { version: string; release_notes: string; entry_url: string }) => {
    const res = await fetch(`/api/developer/apps/${appId}/versions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-developer-address": address || "",
      },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setShowCreateForm(false);
      fetchData();
    }
  };

  const handlePublish = async (versionId: string) => {
    await fetch(`/api/developer/apps/${appId}/versions/${versionId}/publish`, {
      method: "POST",
      headers: { "x-developer-address": address || "" },
    });
    fetchData();
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="h-8 w-48 bg-gray-200 dark:bg-white/10 rounded animate-pulse mb-4" />
          <div className="h-4 w-96 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
        </div>
      </Layout>
    );
  }

  if (!app) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">App not found</h2>
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
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{app.name}</h1>
            <p className="text-gray-500 mt-1">{app.description}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 dark:border-white/10 mb-6">
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
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">App Versions</h2>
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
        active ? "border-neo text-neo" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function SettingsTab({ app, onUpdate }: { app: App; onUpdate: () => void }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 bg-white dark:bg-[#080808] border border-gray-200 dark:border-white/10">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">App Settings</h3>
        <p className="text-gray-500 text-sm">Settings panel coming soon...</p>
      </div>

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

export const getServerSideProps = async () => ({ props: {} });
