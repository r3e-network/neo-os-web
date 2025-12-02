import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ServiceDefinition, ServiceDescriptor, ServicePagePlugin } from '../types';

// Service registry for plugins
const servicePlugins = new Map<string, ServicePagePlugin>();

// Register a service plugin
export function registerServicePlugin(plugin: ServicePagePlugin) {
  servicePlugins.set(plugin.serviceId, plugin);
}

// Get all registered plugins
export function getServicePlugins(): ServicePagePlugin[] {
  return Array.from(servicePlugins.values());
}

// Get a specific plugin
export function getServicePlugin(serviceId: string): ServicePagePlugin | undefined {
  return servicePlugins.get(serviceId);
}

interface ServiceContextType {
  services: ServiceDefinition[];
  descriptors: ServiceDescriptor[];
  loading: boolean;
  error: string | null;
  refreshServices: () => Promise<void>;
  getService: (id: string) => ServiceDefinition | undefined;
  getPlugin: (id: string) => ServicePagePlugin | undefined;
}

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

// Default service definitions (will be enhanced by backend descriptors)
const defaultServices: ServiceDefinition[] = [
  {
    id: 'oracle',
    name: 'Oracle Service',
    description: 'Decentralized oracle network for external data feeds',
    icon: 'visibility',
    category: 'oracle',
    status: 'online',
    version: '1.0.0',
    capabilities: ['price-feeds', 'custom-data', 'aggregation'],
  },
  {
    id: 'vrf',
    name: 'VRF Service',
    description: 'Verifiable Random Function for provably fair randomness',
    icon: 'casino',
    category: 'compute',
    status: 'online',
    version: '1.0.0',
    capabilities: ['random-generation', 'proof-verification'],
  },
  {
    id: 'automation',
    name: 'Automation Service',
    description: 'Automated job scheduling and execution',
    icon: 'schedule',
    category: 'compute',
    status: 'online',
    version: '1.0.0',
    capabilities: ['cron-jobs', 'triggers', 'webhooks'],
  },
  {
    id: 'gasbank',
    name: 'GasBank Service',
    description: 'Service-owned gas management and settlements',
    icon: 'account_balance',
    category: 'utility',
    status: 'online',
    version: '1.0.0',
    capabilities: ['deposits', 'withdrawals', 'settlements'],
  },
  {
    id: 'secrets',
    name: 'Secrets Service',
    description: 'Secure secret storage and resolution',
    icon: 'lock',
    category: 'security',
    status: 'online',
    version: '1.0.0',
    capabilities: ['encryption', 'access-control', 'resolution'],
  },
  {
    id: 'datafeeds',
    name: 'Data Feeds Service',
    description: 'Aggregated data feed definitions and updates',
    icon: 'rss_feed',
    category: 'data',
    status: 'online',
    version: '1.0.0',
    capabilities: ['price-feeds', 'custom-feeds', 'aggregation'],
  },
  {
    id: 'datastreams',
    name: 'Data Streams Service',
    description: 'Real-time data streaming service',
    icon: 'stream',
    category: 'data',
    status: 'online',
    version: '1.0.0',
    capabilities: ['streaming', 'subscriptions', 'filters'],
  },
  {
    id: 'ccip',
    name: 'CCIP Service',
    description: 'Cross-chain interoperability protocol',
    icon: 'swap_horiz',
    category: 'cross-chain',
    status: 'online',
    version: '1.0.0',
    capabilities: ['cross-chain-messaging', 'token-transfers'],
  },
  {
    id: 'mixer',
    name: 'Mixer Service',
    description: 'Privacy-preserving transaction mixing',
    icon: 'shuffle',
    category: 'privacy',
    status: 'online',
    version: '1.0.0',
    capabilities: ['mixing', 'privacy', 'multi-sig'],
  },
  {
    id: 'confidential',
    name: 'Confidential Compute',
    description: 'TEE-based confidential computing',
    icon: 'security',
    category: 'security',
    status: 'online',
    version: '1.0.0',
    capabilities: ['tee', 'attestation', 'secure-execution'],
  },
  {
    id: 'cre',
    name: 'CRE Service',
    description: 'Composable Run Engine for playbooks',
    icon: 'play_circle',
    category: 'compute',
    status: 'online',
    version: '1.0.0',
    capabilities: ['playbooks', 'workflows', 'composition'],
  },
  {
    id: 'dta',
    name: 'DTA Service',
    description: 'Data Token Assets marketplace',
    icon: 'storefront',
    category: 'data',
    status: 'online',
    version: '1.0.0',
    capabilities: ['data-products', 'marketplace', 'licensing'],
  },
  {
    id: 'datalink',
    name: 'DataLink Service',
    description: 'Data delivery channels and subscriptions',
    icon: 'link',
    category: 'data',
    status: 'online',
    version: '1.0.0',
    capabilities: ['channels', 'deliveries', 'subscriptions'],
  },
  {
    id: 'accounts',
    name: 'Accounts Service',
    description: 'Account registry and metadata management',
    icon: 'person',
    category: 'utility',
    status: 'online',
    version: '1.0.0',
    capabilities: ['account-management', 'metadata'],
  },
];

export function ServiceProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<ServiceDefinition[]>(defaultServices);
  const [descriptors, setDescriptors] = useState<ServiceDescriptor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshServices = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch service descriptors from backend
      const response = await fetch('/api/system/descriptors');
      if (response.ok) {
        const data = await response.json();
        setDescriptors(data.descriptors || []);

        // Merge with default services
        // Backend descriptors can override status and add new services
      }
    } catch (err) {
      console.warn('Failed to fetch service descriptors, using defaults');
      // Don't set error - use defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshServices();
  }, []);

  const getService = (id: string): ServiceDefinition | undefined => {
    return services.find(s => s.id === id);
  };

  const getPlugin = (id: string): ServicePagePlugin | undefined => {
    return getServicePlugin(id);
  };

  return (
    <ServiceContext.Provider
      value={{
        services,
        descriptors,
        loading,
        error,
        refreshServices,
        getService,
        getPlugin,
      }}
    >
      {children}
    </ServiceContext.Provider>
  );
}

export function useServices(): ServiceContextType {
  const context = useContext(ServiceContext);
  if (context === undefined) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
}
