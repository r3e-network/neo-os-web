// Service Layer Types

// Service Definition
export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: ServiceCategory;
  status: ServiceStatus;
  version: string;
  endpoints?: string[];
  capabilities?: string[];
}

export type ServiceCategory =
  | 'oracle'      // Data oracle services
  | 'compute'     // Compute/execution services
  | 'data'        // Data feed services
  | 'security'    // Security services
  | 'privacy'     // Privacy services
  | 'cross-chain' // Cross-chain services
  | 'utility';    // Utility services

export type ServiceStatus = 'online' | 'offline' | 'maintenance' | 'beta';

// Wallet Types
export interface WalletState {
  connected: boolean;
  connecting?: boolean;
  address: string | null;
  network: string | null;
  balance: string | null;
}

export interface WalletContextType {
  wallet: WalletState;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  error: string | null;
}

// Account Types
export interface Account {
  id: string;
  owner: string;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// Service Page Plugin Interface
export interface ServicePagePlugin {
  serviceId: string;
  name: string;
  description: string;
  icon: React.ComponentType;
  // Documentation component
  DocsComponent?: React.ComponentType;
  // Workstation component for interactive use
  WorkstationComponent?: React.ComponentType<WorkstationProps>;
  // Custom tabs
  customTabs?: ServiceTab[];
}

export interface ServiceTab {
  id: string;
  label: string;
  icon?: React.ComponentType;
  component: React.ComponentType;
}

export interface WorkstationProps {
  wallet: WalletState;
  accountId?: string;
  onAction?: (action: string, data: unknown) => void;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// System Status
export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'down';
  services: ServiceHealth[];
  uptime: number;
  version: string;
}

export interface ServiceHealth {
  name: string;
  status: 'running' | 'stopped' | 'failed';
  lastCheck: string;
}

// Service Descriptor (from backend)
export interface ServiceDescriptor {
  name: string;
  domain: string;
  description: string;
  version: string;
  capabilities: string[];
  dependsOn: string[];
  status: string;
}
