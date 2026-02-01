/**
 * Common TypeScript types for the platform frontend
 */

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
  success: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Loading state types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  status: LoadingState;
}

// User types
export interface User {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  walletAddress?: string;
  createdAt: string;
  updatedAt: string;
}

// MiniApp types
export interface MiniApp {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  version: string;
  status: MiniAppStatus;
  author: string;
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export type MiniAppStatus = 
  | 'draft' 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'published';
