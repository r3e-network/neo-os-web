import Head from "next/head";
import Link from "next/link";
import { Layout, PageHero } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Database, KeyRound, Network } from "lucide-react";

const apiGroups = [
  {
    name: "Catalog",
    path: "/api/miniapps/catalog",
    description: "Returns published MiniApp definitions, media, permissions, operations, and contract metadata.",
    icon: Database,
  },
  {
    name: "RPC Proxy",
    path: "/api/rpc/neo",
    description: "Routes approved Neo N3 JSON-RPC calls through the host allowlist and network configuration.",
    icon: Network,
  },
  {
    name: "Health",
    path: "/api/health",
    description: "Reports host availability for uptime checks and deployment smoke tests.",
    icon: Activity,
  },
  {
    name: "CSRF",
    path: "/api/csrf-token",
    description: "Issues browser-scoped CSRF tokens for state-changing platform requests.",
    icon: KeyRound,
  },
];

export default function ApiReferencePage() {
  return (
    <Layout>
      <Head>
        <title>API Reference | R3E Network</title>
        <meta
          name="description"
          content="Host API reference for MiniApp catalog, RPC, health, and browser security endpoints."
        />
      </Head>

      <PageHero
        align="center"
        eyebrow="Developer Docs"
        title="API Reference"
        description="Stable host endpoints used by the MiniApp platform, developer console, and validation tooling."
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/docs">
            <Button variant="outline">Documentation</Button>
          </Link>
          <Link href="/miniapps">
            <Button>Browse MiniApps</Button>
          </Link>
        </div>
      </PageHero>

      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-5 md:grid-cols-2">
          {apiGroups.map((group) => {
            const Icon = group.icon;
            return (
              <Card key={group.path} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{group.name}</h2>
                    <code className="mt-2 block rounded-md bg-gray-100 px-2 py-1 text-sm text-gray-700">
                      {group.path}
                    </code>
                    <p className="mt-3 text-sm leading-6 text-gray-600">{group.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </Layout>
  );
}
