"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/**
 * Template Marketplace
 * Pre-built templates that users can select when creating miniapps
 */

export type TemplateCategory = {
  id: string;
  name: string;
  description: string;
  icon: string;
  count: number;
};

export type TemplateItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  icon: string;
  features: string[];
  blueprint: {
    layout: string;
    hero?: Record<string, string>;
    tabs: Array<{ id: string; label: string; type: string }>;
    operation_panel: Record<string, string>;
  };
  config_schema?: Record<string, unknown>;
  popularity: number;
  isPro?: boolean;
};

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: "gaming", name: "Gaming", description: "Games and entertainment", icon: "🎮", count: 12 },
  { id: "defi", name: "DeFi", description: "Financial applications", icon: "💰", count: 8 },
  { id: "social", name: "Social", description: "Community and social", icon: "👥", count: 6 },
  { id: "nft", name: "NFT", description: "NFT and collectibles", icon: "🖼️", count: 5 },
  { id: "governance", name: "Governance", description: "Voting and DAO", icon: "🏛️", count: 4 },
  { id: "utility", name: "Utility", description: "Tools and utilities", icon: "🔧", count: 10 },
];

const TEMPLATES: TemplateItem[] = [
  {
    id: "prediction-market",
    name: "Prediction Market",
    description: "Create markets where users can trade on the outcomes of events",
    category: "defi",
    version: "2.0.0",
    author: "Platform",
    icon: "📈",
    features: ["Multiple outcomes", "Oracle integration", "Automatic resolution", "Trading panel"],
    blueprint: {
      layout: "trading",
      hero: { eyebrow: "Prediction Market", disclaimer: "Trade at your own risk" },
      tabs: [
        { id: "markets", label: "Markets", type: "content" },
        { id: "history", label: "History", type: "content" },
        { id: "comments", label: "Comments", type: "forum" },
      ],
      operation_panel: { title: "Trade", subtitle: "Select market and trade", cta_label: "Place Order" },
    },
    popularity: 95,
  },
  {
    id: "simple-voting",
    name: "Simple Voting",
    description: "Basic voting system for community decisions",
    category: "governance",
    version: "1.5.0",
    author: "Platform",
    icon: "🗳️",
    features: ["Multiple options", "One vote per address", "Result visualization", "Deadline support"],
    blueprint: {
      layout: "voting",
      hero: { eyebrow: "Voting", disclaimer: "One vote per address" },
      tabs: [
        { id: "proposals", label: "Proposals", type: "content" },
        { id: "results", label: "Results", type: "content" },
        { id: "discussion", label: "Discussion", type: "forum" },
      ],
      operation_panel: { title: "Cast Vote", subtitle: "Select option and vote", cta_label: "Vote" },
    },
    popularity: 88,
  },
  {
    id: "lottery",
    name: "Lottery",
    description: "Random draw lottery with configurable prizes",
    category: "gaming",
    version: "1.8.0",
    author: "Platform",
    icon: "🎰",
    features: ["Random selection", "Configurable odds", "Prize tiers", "Ticket sales"],
    blueprint: {
      layout: "trading",
      hero: { eyebrow: "Lottery", disclaimer: "Play responsibly" },
      tabs: [
        { id: "current", label: "Current Round", type: "content" },
        { id: "history", label: "History", type: "content" },
        { id: "winners", label: "Winners", type: "content" },
      ],
      operation_panel: { title: "Buy Ticket", subtitle: "Purchase a lottery ticket", cta_label: "Buy Ticket" },
    },
    popularity: 82,
  },
  {
    id: "leaderboard",
    name: "Leaderboard",
    description: "Competition leaderboard with rankings and scores",
    category: "gaming",
    version: "1.2.0",
    author: "Platform",
    icon: "🏆",
    features: ["Real-time rankings", "Score tracking", "Player profiles", "Historical data"],
    blueprint: {
      layout: "gaming",
      hero: { eyebrow: "Leaderboard" },
      tabs: [
        { id: "rankings", label: "Rankings", type: "content" },
        { id: "history", label: "History", type: "content" },
        { id: "rules", label: "Rules", type: "content" },
      ],
      operation_panel: { title: "Submit Score", subtitle: "Record your score", cta_label: "Submit" },
    },
    popularity: 75,
  },
  {
    id: "nft-marketplace",
    name: "NFT Marketplace",
    description: "Buy and sell NFTs with listing and bidding",
    category: "nft",
    version: "1.0.0",
    author: "Platform",
    icon: "🖼️",
    features: ["Listings", "Auctions", "Offers", "Collection view"],
    blueprint: {
      layout: "trading",
      hero: { eyebrow: "NFT Marketplace", disclaimer: "Trade at your own risk" },
      tabs: [
        { id: "browse", label: "Browse", type: "content" },
        { id: "collections", label: "Collections", type: "content" },
        { id: "activity", label: "Activity", type: "news" },
      ],
      operation_panel: { title: "Buy / List", subtitle: "Purchase or list NFT", cta_label: "Trade" },
    },
    popularity: 70,
    isPro: true,
  },
  {
    id: "data-feed",
    name: "Data Feed",
    description: "Display data with charts and statistics",
    category: "utility",
    version: "1.0.0",
    author: "Platform",
    icon: "📊",
    features: ["Real-time data", "Charts", "Custom queries", "API integration"],
    blueprint: {
      layout: "info",
      hero: { eyebrow: "Data Feed" },
      tabs: [
        { id: "overview", label: "Overview", type: "content" },
        { id: "charts", label: "Charts", type: "content" },
        { id: "api", label: "API", type: "content" },
      ],
      operation_panel: { title: "Query Data", subtitle: "Run a custom query", cta_label: "Query" },
    },
    popularity: 65,
  },
];

type TemplateMarketplaceProps = {
  onSelectTemplate?: (template: TemplateItem) => void;
  onClose?: () => void;
};

export function TemplateMarketplace({ onSelectTemplate, onClose }: TemplateMarketplaceProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = TEMPLATES.filter((template) => {
    const matchesCategory = !selectedCategory || template.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Template Marketplace</h2>
          <p className="text-sm text-gray-500">Choose a pre-built template to get started</p>
        </div>
        {onClose && (
          <Button variant="ghost" onClick={onClose}>Close</Button>
        )}
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            !selectedCategory 
              ? "bg-neo text-black" 
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
          }`}
        >
          All Templates
        </button>
        {TEMPLATE_CATEGORIES.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === category.id
                ? "bg-neo text-black"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
            }`}
          >
            {category.icon} {category.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
        />
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <TemplateCard 
            key={template.id} 
            template={template} 
            onSelect={() => onSelectTemplate?.(template)}
          />
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No templates found matching your criteria
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, onSelect }: { template: TemplateItem; onSelect: () => void }) {
  return (
    <Card className="hover:border-neo transition-colors cursor-pointer" onClick={onSelect}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{template.icon}</span>
            <div>
              <CardTitle className="text-base">{template.name}</CardTitle>
              <p className="text-xs text-gray-500">v{template.version} by {template.author}</p>
            </div>
          </div>
          {template.isPro && (
            <Badge variant="warning">Pro</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {template.description}
        </p>
        
        <div className="flex flex-wrap gap-1 mb-4">
          {template.features.slice(0, 3).map((feature) => (
            <span 
              key={feature}
              className="inline-flex px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              {feature}
            </span>
          ))}
          {template.features.length > 3 && (
            <span className="text-xs text-gray-400">+{template.features.length - 3} more</span>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <span>🔥</span>
            <span>{template.popularity}%</span>
          </div>
          <Button size="sm">Use Template</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default TemplateMarketplace;
