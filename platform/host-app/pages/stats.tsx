import Head from "next/head";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Mock platform stats
const platformStats = {
  totalTransactions: 1234567,
  activeUsers: 45230,
  totalVolume: "2,500,000",
  miniApps: 23,
};

// Mock data feeds
const dataFeeds = [
  { symbol: "NEO/USD", price: 12.45, change: 2.3 },
  { symbol: "GAS/USD", price: 4.82, change: -1.2 },
  { symbol: "BTC/USD", price: 43250, change: 0.8 },
  { symbol: "ETH/USD", price: 2280, change: 1.5 },
];

export default function StatsPage() {
  return (
    <Layout>
      <Head>
        <title>Statistics - Neo MiniApp Platform</title>
      </Head>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900">Platform Statistics</h1>
        <p className="mt-2 text-gray-600">Real-time metrics and data feeds</p>

        {/* Stats Grid */}
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Transactions" value={platformStats.totalTransactions.toLocaleString()} icon="📊" />
          <StatCard title="Active Users" value={platformStats.activeUsers.toLocaleString()} icon="👥" />
          <StatCard title="Total Volume" value={`${platformStats.totalVolume} GAS`} icon="💰" />
          <StatCard title="MiniApps" value={platformStats.miniApps.toString()} icon="📱" />
        </div>

        {/* Data Feeds */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-gray-900">Live Data Feeds</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {dataFeeds.map((feed) => (
              <Card key={feed.symbol}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">{feed.symbol}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${feed.price.toLocaleString()}</div>
                  <div className={`text-sm ${feed.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {feed.change >= 0 ? "+" : ""}
                    {feed.change}%
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
          <div className="text-3xl">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export const getServerSideProps = async () => {
  return { props: {} };
};
