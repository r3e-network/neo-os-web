/**
 * Blueprint Components Index
 * Polymarket-style generic layout components
 * 
 * Performance Optimizations:
 * - React.memo for all components
 * - useMemo for expensive computations
 * - useCallback for stable function references
 * - Virtual scrolling for large data lists
 * - Performance monitoring hooks
 */

export * from "./types";
export * from "./TradingLayout";
export * from "./MarketCard";
export * from "./OperationForm";
export * from "./StatsDisplay";
export * from "./DynamicComponent";
export * from "./DataTable";
export * from "./Timeline";
export * from "./Leaderboard";

// Performance monitoring utilities
export * from "./usePerformanceMonitor";
