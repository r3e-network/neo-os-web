import type { ReactNode } from "react";
import { MiniAppPage } from "./MiniAppPage";
import { HeroSection } from "./HeroSection";
import { HeroStatsStrip } from "./HeroStatsStrip";
import { StatsDisplay } from "./StatsDisplay";
import { NeoCard } from "@shared/components-react";
import type { HeroStatsStripItem } from "./HeroStatsStrip";
import type { StatsDisplayItem } from "./StatsDisplay";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import type { StatusMessage } from "@shared/react";

export interface ConsoleMiniAppProps {
  pageName: string;
  templateConfig: MiniAppTemplateConfig;
  appState: Record<string, unknown>;
  t: (key: string) => string;
  status: StatusMessage | null;
  sidebarItems: Array<{ label: string; value: string | number | boolean | null | undefined }>;
  sidebarTitle: string;
  fallbackMessage: string;
  handleBoundaryError: (error: Error) => void;
  onRetry?: () => void;
  heroIcon: string;
  heroStats: HeroStatsStripItem[];
  overviewStats: StatsDisplayItem[];
  resultTitle: string;
  operationTitle: string;
  wrapResultCard?: boolean;
  wrapOperationCard?: boolean;
  /** Render prop for the result area */
  renderResult?: () => ReactNode;
  /** Render prop for the operation area */
  renderOperation?: () => ReactNode;
}

export function ConsoleMiniApp({
  pageName,
  templateConfig,
  appState,
  t,
  status,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  handleBoundaryError,
  onRetry,
  heroIcon,
  heroStats,
  overviewStats,
  resultTitle,
  operationTitle,
  wrapResultCard = true,
  wrapOperationCard = true,
  renderResult,
  renderOperation,
}: ConsoleMiniAppProps) {
  const resultContent = renderResult?.();
  const operationContent = renderOperation?.();

  return (
    <MiniAppPage
      name={pageName}
      config={templateConfig}
      state={appState}
      t={t}
      statusMessage={status}
      sidebarItems={sidebarItems}
      sidebarTitle={sidebarTitle}
      fallbackMessage={fallbackMessage}
      onBoundaryError={handleBoundaryError}
      onBoundaryRetry={onRetry}
    >
      <HeroSection variant="erobo" icon={heroIcon} compact stats={<HeroStatsStrip items={heroStats} compact />} />

      <StatsDisplay items={overviewStats} layout="grid" className="mb-6" />

      {wrapResultCard ? (
        <NeoCard variant="erobo" title={resultTitle} className="px-1">
          {resultContent}
        </NeoCard>
      ) : (
        resultContent
      )}

      {wrapOperationCard ? (
        <NeoCard variant="erobo" title={operationTitle} className="px-1">
          {operationContent}
        </NeoCard>
      ) : (
        operationContent
      )}
    </MiniAppPage>
  );
}

export default ConsoleMiniApp;
