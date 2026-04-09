/**
 * OfficialLauncherMiniApp — React equivalent of OfficialLauncherMiniApp.vue
 *
 * A pre-built launcher page layout used by Flamingo and bridge miniapps.
 * Wraps MiniAppPage with a hero section, overview stats, main/detail cards,
 * and an operation panel with action buttons.
 */

import React from "react";
import type { ReactNode } from "react";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import type { StatusMessage } from "../react/hooks/useStatusMessage";
import { MiniAppPage } from "./MiniAppPage";
import "./OfficialLauncherMiniApp.scss";

// ============================================================================
// Types
// ============================================================================

export type CardVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "erobo"
  | "erobo-neo"
  | "erobo-bitcoin";

export interface StatsDisplayItem {
  label: string;
  value: string | number;
  icon?: string;
  variant?: "default" | "success" | "danger" | "warning" | "accent" | "erobo" | "erobo-neo" | "erobo-bitcoin";
  trend?: "up" | "down";
}

export type StatsDisplayLayout = "grid" | "rows";

export interface LauncherCard {
  title: string;
  variant?: CardVariant;
  stats?: StatsDisplayItem[];
  paragraphs?: string[];
  className?: string;
}

export interface LauncherAction {
  label: string;
  variant?: "primary" | "secondary";
  onClick: () => void;
}

export interface LauncherToggle {
  selectedKey: string;
  options: Array<{
    key: string;
    label: string;
    onSelect: () => void;
  }>;
}

export interface OfficialLauncherMiniAppProps {
  pageName: string;
  templateConfig: MiniAppTemplateConfig;
  appState: Record<string, unknown>;
  t: (key: string) => string;
  status: StatusMessage | null;
  sidebarItems?: Array<{ label: string; value: string | number | boolean | null | undefined }>;
  sidebarTitle?: string;
  fallbackMessage?: string;
  handleBoundaryError?: (error: Error) => void;
  resetStatus?: () => void;
  heroMode?: "flamingo" | "bridge";
  heroMark?: string;
  bridgeLeftLabel?: string;
  bridgeRightLabel?: string;
  heroKicker: string;
  heroTitle: string;
  heroBlurb: string;
  overviewStats?: StatsDisplayItem[];
  mainCards?: LauncherCard[];
  detailCards?: LauncherCard[];
  operationTitle: string;
  operationActions?: LauncherAction[];
  operationToggle?: LauncherToggle | null;
}

// ============================================================================
// Sub-components (inline)
// ============================================================================

function StatsDisplayInline({ items, layout, columns }: { items: StatsDisplayItem[]; layout: StatsDisplayLayout; columns?: number }) {
  if (!items.length) return null;
  return (
    <div
      className={`stats-display stats-display--${layout}${columns ? ` stats-display--cols-${columns}` : ""}`}
      role="list"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={`stats-display__item${item.variant ? ` stats-display__item--${item.variant}` : ""}`}
          role="listitem"
          aria-label={`${item.label}: ${item.value}`}
        >
          {item.icon && layout === "grid" && (
            <span className="stats-display__icon" aria-hidden="true">{item.icon}</span>
          )}
          <div className="stats-display__value-row">
            <span className="stats-display__value" aria-hidden="true">{item.value}</span>
            {item.trend && (
              <span className={`stats-display__trend stats-display__trend--${item.trend}`} aria-hidden="true" />
            )}
          </div>
          <span className="stats-display__label" aria-hidden="true">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function OfficialLauncherMiniApp({
  pageName,
  templateConfig,
  appState,
  t,
  status,
  sidebarItems = [],
  sidebarTitle = "",
  fallbackMessage = "",
  handleBoundaryError,
  resetStatus,
  heroMode = "flamingo",
  heroMark,
  bridgeLeftLabel,
  bridgeRightLabel,
  heroKicker,
  heroTitle,
  heroBlurb,
  overviewStats = [],
  mainCards = [],
  detailCards = [],
  operationTitle,
  operationActions = [],
  operationToggle = null,
}: OfficialLauncherMiniAppProps) {
  // Content slot: hero + overview stats + main cards
  const contentNode: ReactNode = (
    <>
      <div className="hero-shell">
        <header className="hero-section hero-section--accent hero-section--compact">
          <div className="hero-section__background" aria-hidden="true">
            {heroMode === "bridge" ? (
              <div className="bridge-scene" aria-hidden="true">
                <div className="bridge-orb">{bridgeLeftLabel || t("bridgeLeftDefault")}</div>
                <div className="bridge-link" />
                <div className="bridge-orb">{bridgeRightLabel || t("bridgeRightDefault")}</div>
              </div>
            ) : (
              <div className="flamingo-scene" aria-hidden="true">
                <div className="flamingo-mark">{heroMark || t("heroMarkDefault")}</div>
                <div className="flamingo-trail" />
              </div>
            )}
          </div>
        </header>
        <div className="hero-copy">
          <span className="hero-kicker">{heroKicker}</span>
          <h1 className="hero-title">{heroTitle}</h1>
          <p className="hero-subtitle">{heroBlurb}</p>
        </div>
      </div>

      <StatsDisplayInline items={overviewStats} layout="grid" columns={3} />

      {mainCards.map((card, idx) => (
        <div
          key={`main-${idx}-${card.title}`}
          className={`neo-card neo-card--${card.variant || "erobo"}${card.className ? ` ${card.className}` : ""}`}
        >
          <div className="neo-card__header">
            <span className="neo-card__title">{card.title}</span>
          </div>
          <div className="neo-card__body">
            {card.stats && card.stats.length > 0 && (
              <StatsDisplayInline items={card.stats} layout="rows" />
            )}
            {card.paragraphs?.map((paragraph, pIdx) => (
              <p key={`p-${pIdx}`} className="copy-text">{paragraph}</p>
            ))}
          </div>
        </div>
      ))}
    </>
  );

  // Detail cards tab
  const renderTabDetails = () => (
    <>
      {detailCards.map((card, idx) => (
        <div
          key={`detail-${idx}-${card.title}`}
          className={`neo-card neo-card--${card.variant || "erobo"}${card.className ? ` ${card.className}` : ""}`}
        >
          <div className="neo-card__header">
            <span className="neo-card__title">{card.title}</span>
          </div>
          <div className="neo-card__body">
            {card.stats && card.stats.length > 0 && (
              <StatsDisplayInline items={card.stats} layout="rows" />
            )}
            {card.paragraphs?.map((paragraph, pIdx) => (
              <p key={`dp-${pIdx}`} className="copy-text">{paragraph}</p>
            ))}
          </div>
        </div>
      ))}
    </>
  );

  // Operation panel
  const renderOperation = () => (
    <div className={`neo-card neo-card--erobo`}>
      <div className="neo-card__header">
        <span className="neo-card__title">{operationTitle}</span>
      </div>
      <div className="neo-card__body">
        {operationToggle && operationToggle.options.length > 0 && (
          <div className="toggle-row">
            {operationToggle.options.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`neo-btn neo-btn--sm neo-btn--${operationToggle.selectedKey === option.key ? "primary" : "secondary"}`}
                aria-pressed={operationToggle.selectedKey === option.key}
                aria-label={option.label}
                onClick={() => option.onSelect()}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        <div className="action-stack">
          {operationActions.map((action) => (
            <button
              key={`${action.label}-${action.variant || "secondary"}`}
              type="button"
              className={`neo-btn neo-btn--${action.variant || "secondary"}`}
              aria-label={action.label}
              onClick={() => action.onClick()}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

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
      onBoundaryRetry={resetStatus}
      renderOperation={renderOperation}
      customTabRenderers={detailCards.length > 0 ? { details: renderTabDetails } : undefined}
    >
      {contentNode}
    </MiniAppPage>
  );
}

export default OfficialLauncherMiniApp;
