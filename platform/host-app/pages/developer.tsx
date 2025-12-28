import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  { icon: "📦", title: "SDK", desc: "TypeScript SDK for building MiniApps" },
  { icon: "🔐", title: "TEE", desc: "Confidential computing support" },
  { icon: "🎲", title: "VRF", desc: "Verifiable random functions" },
  { icon: "📊", title: "Oracles", desc: "Real-time price feeds" },
];

export default function DeveloperPage() {
  return (
    <Layout>
      <Head>
        <title>Developer - Neo MiniApp Platform</title>
      </Head>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold">Developer Portal</h1>
        <p className="mt-2 text-gray-600">Build and publish MiniApps on Neo N3</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="rounded bg-gray-900 p-4 text-sm text-green-400">
                {`npm install @neo-miniapp/sdk
npx create-miniapp my-app`}
              </pre>
              <Link href="/docs">
                <Button className="mt-4">Read Documentation</Button>
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Submit Your App</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Ready to publish? Submit your MiniApp for review.</p>
              <Button className="mt-4" variant="outline">
                Submit MiniApp
              </Button>
            </CardContent>
          </Card>
        </div>

        <h2 className="mt-12 text-xl font-bold">Platform Features</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title}>
              <CardContent className="p-4 text-center">
                <div className="text-3xl">{f.icon}</div>
                <div className="mt-2 font-semibold">{f.title}</div>
                <div className="text-sm text-gray-500">{f.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = async () => ({ props: {} });
