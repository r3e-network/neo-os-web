/**
 * FlamingoLauncherPage — React equivalent of FlamingoLauncherPage.vue
 *
 * Launcher component for Flamingo product miniapps (Swap, Lend, Earn, etc.).
 * Wraps OfficialLauncherMiniApp with product-specific data from the
 * useFlamingoLauncherPage composable.
 *
 * Note: The underlying `useFlamingoLauncherPage` utility still uses Vue
 * reactivity. In a fully-React context, callers should prepare the resolved
 * props directly. This component provides a compatible interface that accepts
 * a `productKey` and delegates to OfficialLauncherMiniApp.
 */

import React from "react";
import type { FlamingoProductKey } from "@shared/utils/flamingo-launcher-page";
import { useFlamingoLauncherPage } from "@shared/utils/flamingo-launcher-page";
import { OfficialLauncherMiniApp } from "./OfficialLauncherMiniApp";

// ============================================================================
// Props
// ============================================================================

export interface FlamingoLauncherPageProps {
  productKey: FlamingoProductKey;
}

// ============================================================================
// Component
// ============================================================================

export function FlamingoLauncherPage({ productKey }: FlamingoLauncherPageProps) {
  const {
    product,
    t,
    templateConfig,
    sidebarItems,
    sidebarTitle,
    fallbackMessage,
    status,
    clearStatus,
    handleBoundaryError,
    appState,
    overviewStats,
    mainCards,
    detailCards,
    operationActions,
  } = useFlamingoLauncherPage(productKey);

  // The composable returns Vue ComputedRefs. Extract `.value` for each.
  // Use explicit `any` casts to bridge Vue reactive types into plain React values.
  const unwrap = (v: unknown): unknown => {
    if (v != null && typeof v === "object" && "value" in v) {
      return (v as { value: unknown }).value;
    }
    return v;
  };

  const resolvedAppState = (unwrap(appState) ?? {}) as Record<string, unknown>;
  const resolvedOverviewStats = (unwrap(overviewStats) ?? []) as Array<{ label: string; value: string | number; icon?: string; variant?: string }>;
  const resolvedMainCards = (unwrap(mainCards) ?? []) as Array<{ title: string; variant?: string; stats?: Array<{ label: string; value: string | number }>; paragraphs?: string[] }>;
  const resolvedDetailCards = (unwrap(detailCards) ?? []) as Array<{ title: string; variant?: string; stats?: Array<{ label: string; value: string | number }>; paragraphs?: string[]; className?: string }>;
  const resolvedOperationActions = (unwrap(operationActions) ?? []) as Array<{ label: string; variant?: "primary" | "secondary"; onClick: () => void }>;
  const resolvedSidebarItems = (unwrap(sidebarItems) ?? []) as Array<{ label: string; value: string | number | boolean | null | undefined }>;
  const resolvedStatus = (unwrap(status) ?? null) as { msg: string; type: string } | null;
  const resolvedSidebarTitle = String(unwrap(sidebarTitle) ?? "");
  const resolvedFallbackMessage = String(unwrap(fallbackMessage) ?? "");

  return (
    <OfficialLauncherMiniApp
      pageName={product.slug}
      templateConfig={templateConfig}
      appState={resolvedAppState}
      t={t}
      status={resolvedStatus as any}
      sidebarItems={resolvedSidebarItems}
      sidebarTitle={resolvedSidebarTitle}
      fallbackMessage={resolvedFallbackMessage}
      handleBoundaryError={handleBoundaryError}
      resetStatus={clearStatus}
      heroMode="flamingo"
      heroMark="F"
      heroKicker={t("protocolValue")}
      heroTitle={t("title")}
      heroBlurb={t("heroBlurb")}
      overviewStats={resolvedOverviewStats as any}
      mainCards={resolvedMainCards as any}
      detailCards={resolvedDetailCards as any}
      operationTitle={t("product")}
      operationActions={resolvedOperationActions}
    />
  );
}

export default FlamingoLauncherPage;
