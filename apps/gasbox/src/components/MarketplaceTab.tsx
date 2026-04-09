import "./MarketplaceTab.scss";

interface MarketplaceTabProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function MarketplaceTab(props: MarketplaceTabProps) {
  return (
    <div className="MarketplaceTab">
      {/* Migrated from MarketplaceTab.vue */}
    </div>
  );
}
