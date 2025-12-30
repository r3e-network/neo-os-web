import type { NextApiRequest, NextApiResponse } from "next";

export interface UserAnalytics {
  wallet: string;
  summary: {
    totalTx: number;
    totalVolume: string;
    appsUsed: number;
    firstActivity: string;
    lastActivity: string;
  };
  activity: ActivityItem[];
  appBreakdown: AppUsage[];
}

interface ActivityItem {
  date: string;
  txCount: number;
  volume: string;
}

interface AppUsage {
  appId: string;
  appName: string;
  txCount: number;
  volume: string;
  lastUsed: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { wallet } = req.query;
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "Wallet address required" });
  }

  const analytics = generateUserAnalytics(wallet);
  return res.status(200).json(analytics);
}

/** Generate user analytics (mock data - replace with Supabase in production) */
function generateUserAnalytics(wallet: string): UserAnalytics {
  const now = new Date();
  const activity = generateActivityHistory(30);
  const appBreakdown = generateAppBreakdown();

  const totalTx = activity.reduce((sum, a) => sum + a.txCount, 0);
  const totalVolume = activity.reduce((sum, a) => sum + parseFloat(a.volume), 0);

  return {
    wallet,
    summary: {
      totalTx,
      totalVolume: totalVolume.toFixed(2),
      appsUsed: appBreakdown.length,
      firstActivity: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastActivity: now.toISOString(),
    },
    activity,
    appBreakdown,
  };
}

/** Generate 30-day activity history */
function generateActivityHistory(days: number): ActivityItem[] {
  const activity: ActivityItem[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    activity.push({
      date: date.toISOString().split("T")[0],
      txCount: Math.floor(Math.random() * 20),
      volume: (Math.random() * 50).toFixed(2),
    });
  }

  return activity;
}

/** Generate app usage breakdown */
function generateAppBreakdown(): AppUsage[] {
  const apps = [
    { appId: "miniapp-lottery", appName: "Lottery" },
    { appId: "miniapp-dicegame", appName: "Dice Game" },
    { appId: "miniapp-coinflip", appName: "Coin Flip" },
    { appId: "miniapp-secretvote", appName: "Secret Vote" },
    { appId: "miniapp-redenvelope", appName: "Red Envelope" },
  ];

  return apps.slice(0, Math.floor(Math.random() * 4) + 2).map((app) => ({
    ...app,
    txCount: Math.floor(Math.random() * 50) + 5,
    volume: (Math.random() * 100).toFixed(2),
    lastUsed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}
