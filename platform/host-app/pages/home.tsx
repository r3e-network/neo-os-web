import Head from "next/head";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { StatsBar } from "@/components/features/stats";
import { MiniAppGrid, type MiniAppInfo } from "@/components/features/miniapp";

// Platform stats
const platformStats = [
  { label: "Total Transactions", value: "1.2M+" },
  { label: "Active Users", value: "45K+" },
  { label: "MiniApps", value: "23" },
  { label: "Total Volume", value: "$2.5M" },
];

// MiniApp catalog
const miniApps: MiniAppInfo[] = [
  {
    app_id: "builtin-lottery",
    name: "Neo Lottery",
    description: "Decentralized lottery with provably fair randomness",
    icon: "🎰",
    category: "gaming",
    stats: { users: 12500, transactions: 45000 },
  },
  {
    app_id: "builtin-coin-flip",
    name: "Coin Flip",
    description: "50/50 coin flip - double your GAS",
    icon: "🪙",
    category: "gaming",
    stats: { users: 8900, transactions: 32000 },
  },
  {
    app_id: "builtin-dice-game",
    name: "Dice Game",
    description: "Roll the dice and win up to 6x",
    icon: "🎲",
    category: "gaming",
    stats: { users: 6700, transactions: 28000 },
  },
  {
    app_id: "builtin-prediction-market",
    name: "Prediction Market",
    description: "Trade on future outcomes",
    icon: "📊",
    category: "defi",
    stats: { users: 3200, transactions: 15000 },
  },
  {
    app_id: "builtin-red-envelope",
    name: "Red Envelope",
    description: "Send lucky GAS gifts to friends",
    icon: "🧧",
    category: "social",
    stats: { users: 5600, transactions: 22000 },
  },
  {
    app_id: "builtin-secret-vote",
    name: "Secret Vote",
    description: "Private on-chain voting",
    icon: "🗳️",
    category: "governance",
    stats: { users: 2100, transactions: 8500 },
  },
];

export default function HomePage() {
  return (
    <Layout>
      <Head>
        <title>Neo MiniApp Platform</title>
        <meta name="description" content="The future of decentralized applications on Neo N3" />
      </Head>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-500 to-primary-700 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h1 className="text-4xl font-bold md:text-6xl">The Future of Decentralized Apps</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-100">
            Discover, play, and build MiniApps on Neo N3 with confidential computing, verifiable randomness, and secure
            payments.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button size="lg" className="bg-white text-primary-600 hover:bg-gray-100">
              Explore MiniApps
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              Start Building
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <StatsBar stats={platformStats} />

      {/* MiniApps Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Popular MiniApps</h2>
            <Button variant="outline">View All</Button>
          </div>
          <MiniAppGrid apps={miniApps} columns={3} />
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold text-gray-900">Platform Features</h2>
          <div className="grid gap-8 md:grid-cols-4">
            {[
              { icon: "🔒", title: "TEE Security", desc: "Confidential computing in secure enclaves" },
              { icon: "🎲", title: "VRF Randomness", desc: "Provably fair on-chain randomness" },
              { icon: "📈", title: "Price Feeds", desc: "Real-time price data from multiple sources" },
              { icon: "⚡", title: "Automation", desc: "Scheduled tasks and workflows" },
            ].map((feature, i) => (
              <div key={i} className="rounded-xl bg-white p-6 text-center shadow-sm">
                <div className="text-4xl">{feature.icon}</div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}

// Disable static generation for Module Federation compatibility
export const getServerSideProps = async () => {
  return { props: {} };
};
