import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const miniAppData: Record<string, any> = {
  "builtin-lottery": {
    name: "Neo Lottery",
    description: "Decentralized lottery with provably fair VRF randomness. Buy tickets and win big prizes!",
    icon: "🎰",
    category: "gaming",
    stats: { users: 12500, transactions: 45000, volume: "125,000 GAS" },
    permissions: ["payments", "randomness"],
  },
  "builtin-coin-flip": {
    name: "Coin Flip",
    description: "Simple 50/50 coin flip game. Double your GAS with on-chain verifiable randomness.",
    icon: "🪙",
    category: "gaming",
    stats: { users: 8900, transactions: 32000, volume: "89,000 GAS" },
    permissions: ["payments", "randomness"],
  },
};

export default function MiniAppDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const app = miniAppData[id as string] || miniAppData["builtin-lottery"];

  return (
    <Layout>
      <Head>
        <title>{app.name} - Neo MiniApp Platform</title>
      </Head>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-start gap-6">
          <div className="text-6xl">{app.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{app.name}</h1>
              <Badge>{app.category}</Badge>
            </div>
            <p className="mt-2 text-gray-600">{app.description}</p>
            <div className="mt-4">
              <Link href={`/app/${id}`}>
                <Button size="lg">Launch App</Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{app.stats.users.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Users</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{app.stats.transactions.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Transactions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{app.stats.volume}</div>
              <div className="text-sm text-gray-500">Volume</div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold">Permissions</h2>
          <div className="mt-2 flex gap-2">
            {app.permissions.map((p: string) => (
              <Badge key={p} variant="outline">
                {p}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = async () => ({ props: {} });
