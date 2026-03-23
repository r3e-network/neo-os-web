"use client";

import { SelectField, TextField } from "@/components/forms";

type TemplateMarketFiltersProps = {
  categories: readonly string[];
  marketKind: string;
  marketCategory: string;
  marketSource: string;
  marketVerified: string;
  marketSearch: string;
  onMarketKindChange: (value: string) => void;
  onMarketCategoryChange: (value: string) => void;
  onMarketSourceChange: (value: string) => void;
  onMarketVerifiedChange: (value: string) => void;
  onMarketSearchChange: (value: string) => void;
};

export function TemplateMarketFilters({
  categories,
  marketKind,
  marketCategory,
  marketSource,
  marketVerified,
  marketSearch,
  onMarketKindChange,
  onMarketCategoryChange,
  onMarketSourceChange,
  onMarketVerifiedChange,
  onMarketSearchChange,
}: TemplateMarketFiltersProps) {
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-5">
      <SelectField
        variant="glass"
        id="filter-kind"
        aria-label="Filter kind"
        value={marketKind}
        onChange={(e) => onMarketKindChange(e.target.value)}
      >
        <option value="all">All Kinds</option>
        <option value="frontend">Frontend</option>
        <option value="contract">Contract</option>
      </SelectField>
      <SelectField
        variant="glass"
        id="filter-category"
        aria-label="Filter category"
        value={marketCategory}
        onChange={(e) => onMarketCategoryChange(e.target.value)}
      >
        <option value="all">All Categories</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </SelectField>
      <SelectField
        variant="glass"
        id="filter-source"
        aria-label="Filter source"
        value={marketSource}
        onChange={(e) => onMarketSourceChange(e.target.value)}
      >
        <option value="all">All Sources</option>
        <option value="community">Community</option>
        <option value="verified">Verified</option>
        <option value="miniapp">MiniApp</option>
      </SelectField>
      <SelectField
        variant="glass"
        id="filter-verified"
        aria-label="Filter verified"
        value={marketVerified}
        onChange={(e) => onMarketVerifiedChange(e.target.value)}
      >
        <option value="all">All Verification</option>
        <option value="true">Verified Only</option>
      </SelectField>
      <TextField
        variant="glass"
        id="template-search"
        aria-label="Search templates"
        type="text"
        value={marketSearch}
        onChange={(e) => onMarketSearchChange(e.target.value)}
        placeholder="Search ID/name..."
      />
    </div>
  );
}
