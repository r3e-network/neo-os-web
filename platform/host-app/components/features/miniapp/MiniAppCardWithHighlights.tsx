/**
 * MiniAppCardWithHighlights
 * Wrapper component that fetches dynamic highlights for MiniApp cards
 */

"use client";

import { useEffect, useState } from "react";
import { MiniAppCard, type MiniAppInfo } from "./MiniAppCard";
import type { HighlightData } from "./DynamicBanner";
import { getAppHighlights } from "@/lib/app-highlights";

interface Props {
  app: MiniAppInfo;
}

export function MiniAppCardWithHighlights({ app }: Props) {
  const [highlights, setHighlights] = useState<HighlightData[] | undefined>(
    () => app.highlights || getAppHighlights(app.app_id),
  );

  useEffect(() => {
    // Skip if already has highlights
    if (app.highlights) return;

    // Fetch dynamic highlights
    fetch(`/api/app-highlights/${app.app_id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.highlights?.length) {
          setHighlights(data.highlights);
        }
      })
      .catch(() => {
        // Keep static fallback on error
      });
  }, [app.app_id, app.highlights]);

  return <MiniAppCard app={{ ...app, highlights }} />;
}
