"use client";

import { Store } from "lucide-react";
import { DeveloperStateCard } from "./DeveloperStateCard";
import { TemplateMarketCard } from "./TemplateMarketCard";
import { TemplateMarketFilters } from "./TemplateMarketFilters";
import type { MarketTemplateItem } from "./types";

type TemplateMarketplaceSectionProps = {
  categories: readonly string[];
  marketKind: string;
  marketCategory: string;
  marketSource: string;
  marketVerified: string;
  marketSearch: string;
  marketLoading: boolean;
  marketError: string;
  marketTemplates: MarketTemplateItem[];
  onMarketKindChange: (value: string) => void;
  onMarketCategoryChange: (value: string) => void;
  onMarketSourceChange: (value: string) => void;
  onMarketVerifiedChange: (value: string) => void;
  onMarketSearchChange: (value: string) => void;
  onApplyTemplate: (item: MarketTemplateItem) => void;
};

export function TemplateMarketplaceSection({
  categories,
  marketKind,
  marketCategory,
  marketSource,
  marketVerified,
  marketSearch,
  marketLoading,
  marketError,
  marketTemplates,
  onMarketKindChange,
  onMarketCategoryChange,
  onMarketSourceChange,
  onMarketVerifiedChange,
  onMarketSearchChange,
  onApplyTemplate,
}: TemplateMarketplaceSectionProps) {
  return (
    <section className="py-12 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Template Marketplace
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Browse published frontend and contract templates, then install
              to builder in one click.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600">
            <Store size={14} aria-hidden="true" />
            Live Market Feed
          </div>
        </div>

        <TemplateMarketFilters
          categories={categories}
          marketKind={marketKind}
          marketCategory={marketCategory}
          marketSource={marketSource}
          marketVerified={marketVerified}
          marketSearch={marketSearch}
          onMarketKindChange={onMarketKindChange}
          onMarketCategoryChange={onMarketCategoryChange}
          onMarketSourceChange={onMarketSourceChange}
          onMarketVerifiedChange={onMarketVerifiedChange}
          onMarketSearchChange={onMarketSearchChange}
        />

        {marketError ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-sm text-red-300">
            {marketError}
          </div>
        ) : null}

        {marketLoading ? (
          <DeveloperStateCard message="Loading template marketplace..." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {marketTemplates.slice(0, 18).map((item) => (
              <TemplateMarketCard
                key={`${item.template_kind}:${item.template_id}:${item.version}`}
                templateKind={item.template_kind}
                templateId={item.template_id}
                version={item.version}
                name={item.name}
                description={item.description}
                category={item.category}
                sourceType={item.source_type}
                isVerified={item.is_verified}
                usageCount={item.usage_count}
                ratingAvg={item.rating_avg}
                ratingCount={item.rating_count}
                tags={item.tags}
                onInstall={() => onApplyTemplate(item)}
              />
            ))}
            {!marketTemplates.length ? (
              <DeveloperStateCard message="No templates matched current filters." />
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
