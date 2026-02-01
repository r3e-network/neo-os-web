/**
 * Search Component Types
 * Steam-inspired search with autocomplete
 */

export interface SearchResult {
  app_id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  score: number;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  suggestions: string[];
  isLoading: boolean;
  isOpen: boolean;
  selectedIndex: number;
}

export interface RecentSearch {
  query: string;
  timestamp: number;
}

export const RECENT_SEARCHES_KEY = "neohub_recent_searches";
export const MAX_RECENT_SEARCHES = 5;
