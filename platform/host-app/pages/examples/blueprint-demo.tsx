/**
 * Generic MiniApp Detail Page
 * Uses Blueprint components to render a Polymarket-style layout
 */

import { useState, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  TradingLayout,
  MarketList,
  OperationList,
  StatsDisplay,
  type MarketCardData,
  type Operation,
  type StatItem,
  getBlueprintConfig,
} from "@/components/blueprints";

type MiniAppDetailPageProps = {
  appId: string;
  name: string;
  description: string;
  contractHash?: string;
  layout?: "default" | "trading" | "voting" | "gaming" | "info";
  hero?: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    disclaimer?: string;
  };
  operations?: Operation[];
  markets?: MarketCardData[];
  stats?: StatItem[];
  tabs?: Array<{ id: string; label: string }>;
};

export default function GenericMiniAppPage({
  appId,
  name,
  description,
  contractHash,
  layout = "trading",
  hero,
  operations = [],
  markets = [],
  stats = [],
  tabs = [],
}: MiniAppDetailPageProps) {
  const router = useRouter();
  const [selectedMarket, setSelectedMarket] = useState<string | undefined>(
    markets[0]?.id
  );
  const [invokeResult, setInvokeResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const blueprint = getBlueprintConfig(layout);

  const handleInvoke = useCallback(
    async (operation: Operation, values: Record<string, string>) => {
      setInvokeResult(null);

      if (!contractHash) {
        throw new Error("Contract not deployed");
      }

      console.log("Invoking:", operation.method, values);
      
      // Simulate transaction
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setInvokeResult({
        type: "success",
        message: `Transaction submitted for ${operation.name}`,
      });
    },
    [contractHash]
  );

  const handleBack = () => {
    router.push("/miniapps");
  };

  const handleLaunch = () => {
    console.log("Launch app:", appId);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Head>
        <title>{`${name} - R3E Network`}</title>
      </Head>

      <TradingLayout
        hero={
          <div className="max-w-[1440px] mx-auto px-4 py-6">
            <button
              onClick={handleBack}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
            >
              ← Back to MiniApps
            </button>
            
            {hero?.eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-wider text-neo mb-2">
                {hero.eyebrow}
              </p>
            )}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {hero?.title || name}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-2xl">
              {description}
            </p>
            {hero?.disclaimer && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {hero.disclaimer}
              </p>
            )}
          </div>
        }
        stats={
          stats.length > 0 ? (
            <div className="max-w-[1440px] mx-auto px-4 py-3">
              <StatsDisplay stats={stats} columns={4} />
            </div>
          ) : undefined
        }
        tabs={
          tabs.length > 0 ? (
            <Tabs
              tabs={tabs}
              selected={tabs[0]?.id}
              onChange={() => {}}
            />
          ) : undefined
        }
        leftPanel={
          markets.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Markets
              </h2>
              <MarketList
                markets={markets}
                selectedId={selectedMarket}
                onSelect={setSelectedMarket}
              />
            </div>
          ) : undefined
        }
        operations={operations as any}
        onInvoke={handleInvoke as any}
        operationPanelConfig={{
          title: blueprint.operationPanel?.title || "Operations",
          subtitle: blueprint.operationPanel?.subtitle,
          ctaLabel: blueprint.operationPanel?.ctaLabel,
          onCtaClick: handleLaunch,
        }}
      />
    </div>
  );
}

function Tabs({
  tabs,
  selected,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  selected: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            selected === tab.id
              ? "border-neo text-neo"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// Example usage data - this would come from the backend/API
export const EXAMPLE_APP_DATA: MiniAppDetailPageProps = {
  appId: "com.example.app",
  name: "Example Trading App",
  description: "A generic trading application built with Blueprint components",
  contractHash: "0x1234567890abcdef",
  layout: "trading",
  hero: {
    eyebrow: "Trading Platform",
    disclaimer: "Trade at your own risk",
  },
  stats: [
    { key: "volume", label: "Total Volume", value: 1250000, icon: "📊", format: "number" },
    { key: "traders", label: "Active Traders", value: 1234, icon: "👥", format: "number" },
    { key: "markets", label: "Active Markets", value: 8, icon: "🎯" },
    { key: "24h", label: "24h Volume", value: 45000, icon: "🔥", format: "number" },
  ],
  markets: [
    {
      id: "1",
      title: "Will NEO reach $50 by Q2 2026?",
      description: "Prediction market for NEO price action",
      status: "active",
      outcomes: [
        { id: "yes", label: "Yes", probability: 0.65, volume: "$81,250" },
        { id: "no", label: "No", probability: 0.35, volume: "$43,750" },
      ],
      stats: { volume: "$125,000", trades: 456 },
      endDate: "2026-04-01T00:00:00Z",
    },
    {
      id: "2",
      title: "Will Bitcoin hit $150k in 2026?",
      description: "Major BTC price prediction",
      status: "active",
      outcomes: [
        { id: "yes", label: "Yes", probability: 0.42, volume: "$52,500" },
        { id: "no", label: "No", probability: 0.58, volume: "$72,500" },
      ],
      stats: { volume: "$125,000", trades: 312 },
      endDate: "2026-12-31T23:59:59Z",
    },
    {
      id: "3",
      title: "Will Ethereum upgrade happen in 2026?",
      description: "Network upgrade prediction",
      status: "resolved",
      winningOutcome: "yes",
      outcomes: [
        { id: "yes", label: "Yes", probability: 0.78, volume: "$97,500" },
        { id: "no", label: "No", probability: 0.22, volume: "$27,500" },
      ],
      stats: { volume: "$125,000", trades: 289 },
      endDate: "2026-01-15T00:00:00Z",
    },
  ],
  operations: [
    {
      name: "Place Order",
      description: "Buy or sell outcomes",
      method: "placeOrder",
      gasCost: "0.01",
      buttonStyle: "primary",
      params: [
        {
          name: "marketId",
          type: "select",
          label: "Market",
          required: true,
          options: [
            { label: "NEO Q2 2026", value: "1" },
            { label: "BTC $150k 2026", value: "2" },
            { label: "ETH Upgrade", value: "3" },
          ],
        },
        {
          name: "outcome",
          type: "select",
          label: "Outcome",
          required: true,
          options: [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ],
        },
        {
          name: "amount",
          type: "amount",
          label: "Amount (GAS)",
          required: true,
          placeholder: "0.1",
          min: 0.1,
        },
      ],
    },
    {
      name: "Claim Winnings",
      description: "Claim your winnings from resolved markets",
      method: "claimWinnings",
      gasCost: "0.005",
      buttonStyle: "success",
      params: [
        {
          name: "marketId",
          type: "select",
          label: "Market",
          required: true,
          options: [
            { label: "ETH Upgrade", value: "3" },
          ],
        },
      ],
    },
  ],
  tabs: [
    { id: "markets", label: "Markets" },
    { id: "history", label: "History" },
    { id: "comments", label: "Comments" },
  ],
};
