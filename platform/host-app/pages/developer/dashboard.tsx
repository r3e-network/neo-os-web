/**
 * Developer Dashboard - Manage your apps
 */

import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { AppCard } from "@/components/features/developer";
import { Plus, Package, BarChart3, Settings } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";

interface App {
  app_id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  visibility: string;
  icon_url?: string;
  updated_at: string;
}

export default function DeveloperDashboard() {
  const { address } = useWalletStore();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    void fetchApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const fetchApps = async () => {
    try {
      const res = await fetch("/api/developer/apps", {
        headers: { "x-developer-address": address || "" },
      });
      const data = await res.json();
      setApps(data.apps || []);
    } catch (err) {
      console.error("Failed to fetch apps:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!address) {
    return (
      <Layout>
        <Head>
          <title>Developer Dashboard - NeoHub</title>
        </Head>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Package size={64} className="mx-auto mb-4 text-gray-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Connect Your Wallet</h2>
            <p className="text-gray-500 mb-6">Connect your Neo wallet to access the developer dashboard</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>Developer Dashboard - NeoHub</title>
      </Head>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Apps</h1>
            <p className="text-gray-500 mt-1">Manage your MiniApps and track performance</p>
          </div>
          <Link href="/developer/apps/new">
            <Button className="bg-neo text-white hover:bg-neo/90">
              <Plus size={18} className="mr-2" />
              Create App
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard icon={Package} label="Total Apps" value={apps.length} color="from-blue-500 to-cyan-500" />
          <StatCard
            icon={BarChart3}
            label="Published"
            value={apps.filter((a) => a.status === "published").length}
            color="from-green-500 to-emerald-500"
          />
          <StatCard
            icon={Settings}
            label="In Review"
            value={apps.filter((a) => a.status === "pending_review").length}
            color="from-yellow-500 to-orange-500"
          />
        </div>

        {/* Apps List */}
        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4">
            {apps.map((app) => (
              <AppCard key={app.app_id} app={app} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Package;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl p-6 bg-white dark:bg-[#080808] border border-gray-200 dark:border-white/10">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon className="text-white" size={24} />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10">
      <Package size={64} className="mx-auto mb-4 text-gray-400" />
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No apps yet</h3>
      <p className="text-gray-500 mb-6">Create your first MiniApp to get started</p>
      <Link href="/developer/apps/new">
        <Button className="bg-neo text-white hover:bg-neo/90">
          <Plus size={18} className="mr-2" />
          Create Your First App
        </Button>
      </Link>
    </div>
  );
}

export const getServerSideProps = async () => ({ props: {} });
