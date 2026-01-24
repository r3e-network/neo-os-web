/**
 * Real Card Data Service - DEPRECATED / SKELETON
 * Dynamic card data has been removed in favor of static banners.
 * This file remains to satisfy type imports but returns no data.
 */

import type { ChainId } from "@/lib/chains/types";

// Stub types to prevent breakage in other files importing them
export interface CountdownData { type: "live_countdown" }
export interface MultiplierData { type: "live_multiplier" }
export interface StatsData { type: "live_stats" }
export interface VotingData { type: "live_voting" }

export type CardType =
  | "live_countdown"
  | "live_multiplier"
  | "live_canvas"
  | "live_stats"
  | "live_voting"
  | "live_price";

export type CardData = CountdownData | MultiplierData | StatsData | VotingData;

export async function getCardData(appId: string, cardType: CardType, chainId: ChainId): Promise<CardData | null> {
  return null;
}
