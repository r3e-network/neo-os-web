import Head from "next/head";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { MiniAppGrid, type MiniAppInfo } from "@/components/features/miniapp";

const categories = ["all", "gaming", "defi", "social", "governance"] as const;

const allMiniApps: MiniAppInfo[] = [
  {
    app_id: "builtin-lottery",
    name: "Neo Lottery",
    description: "Decentralized lottery with VRF",
    icon: "🎰",
    category: "gaming",
    stats: { users: 12500, transactions: 45000 },
  },
  {
    app_id: "builtin-coin-flip",
    name: "Coin Flip",
    description: "50/50 double your GAS",
    icon: "🪙",
    category: "gaming",
    stats: { users: 8900, transactions: 32000 },
  },
  {
    app_id: "builtin-dice-game",
    name: "Dice Game",
    description: "Roll dice, win up to 6x",
    icon: "🎲",
    category: "gaming",
    stats: { users: 6700, transactions: 28000 },
  },
  {
    app_id: "builtin-scratch-card",
    name: "Scratch Card",
    description: "Instant scratch prizes",
    icon: "🎫",
    category: "gaming",
    stats: { users: 4500, transactions: 15000 },
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
    app_id: "builtin-price-predict",
    name: "Price Predict",
    description: "Predict crypto prices",
    icon: "📈",
    category: "defi",
    stats: { users: 2800, transactions: 12000 },
  },
  {
    app_id: "builtin-red-envelope",
    name: "Red Envelope",
    description: "Send lucky GAS gifts",
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

export default function MiniAppsPage() {
  const [category, setCategory] = useState<(typeof categories)[number]>("all");

  const filtered = category === "all" ? allMiniApps : allMiniApps.filter((app) => app.category === category);

  return (
    <Layout>
      <Head>
        <title>MiniApps - Neo MiniApp Platform</title>
      </Head>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold">Discover MiniApps</h1>
        <p className="mt-2 text-gray-600">Browse and explore all available applications</p>

        <div className="mt-6 flex gap-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={category === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Button>
          ))}
        </div>

        <div className="mt-8">
          <MiniAppGrid apps={filtered} columns={3} />
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = async () => ({ props: {} });
