import Head from "next/head";
import Link from "next/link";
import { Layout, PageHero } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code2, ExternalLink, Wallet, ShieldCheck, RadioTower } from "lucide-react";

const sdkAreas = [
  {
    title: "Wallet Sessions",
    description: "Connect Neo wallets, request account metadata, and submit user-approved contract operations.",
    icon: Wallet,
  },
  {
    title: "Protected Runtime",
    description: "Use host-provided helpers for permissions, notifications, confidential storage, and app-scoped identity.",
    icon: ShieldCheck,
  },
  {
    title: "Chain Services",
    description: "Read Neo N3 state, request oracle data, and route approved transactions through configured RPC endpoints.",
    icon: RadioTower,
  },
];

export default function SdkGuidePage() {
  return (
    <Layout>
      <Head>
        <title>SDK Guide | R3E Network</title>
        <meta
          name="description"
          content="MiniApp SDK guide for wallet sessions, host runtime services, and Neo N3 contract calls."
        />
      </Head>

      <PageHero
        align="center"
        eyebrow="Developer Docs"
        title="SDK Guide"
        description="Use the host-injected MiniApp SDK to build wallet-aware, permission-scoped Neo N3 applications without coupling frontend code to a single wallet provider."
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/docs">
            <Button variant="outline">Documentation</Button>
          </Link>
          <Link href="/developer">
            <Button>
              Open Builder
              <Code2 className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </PageHero>

      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-5 md:grid-cols-3">
          {sdkAreas.map((area) => {
            const Icon = area.icon;
            return (
              <Card key={area.title} className="p-6">
                <Icon className="h-6 w-6 text-emerald-600" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-bold text-gray-900">{area.title}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">{area.description}</p>
              </Card>
            );
          })}
        </div>

        <section className="mt-10 rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h2 className="text-lg font-bold text-gray-900">Host SDK entry point</h2>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-950 p-4 text-sm text-gray-100">
            <code>{`const sdk = window.MiniAppSDK;

const account = await sdk.wallet.connect();
const tx = await sdk.invoke({
  contractHash,
  method: "operationName",
  args,
});`}</code>
          </pre>
          <p className="mt-4 text-sm leading-6 text-gray-600">
            Wallet-sensitive operations must remain user-approved. For a complete walkthrough, use the interactive documentation sections on the main docs page.
          </p>
          <Link
            href="/docs"
            className="mt-4 inline-flex items-center text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            View full documentation
            <ExternalLink className="ml-1 h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </main>
    </Layout>
  );
}
