// Wallet connection library for Neo N3 wallets
// Supports: NeoLine, O3, Neon, and OneGate wallets

// Declare the neoWalletAdapters global object
declare global {
  interface Window {
    neoWalletAdapters?: {
      NeoLine: {
        isInstalled: () => boolean;
        init: () => Promise<boolean>;
        getAccount: () => Promise<any>;
        getBalance: (params: any) => Promise<any>;
        getNetworks: () => Promise<any>;
        signMessage: (params: any) => Promise<any>;
        signTransaction: (params: any) => Promise<any>;
        invoke: (params: any) => Promise<any>;
      };
      O3: {
        isInstalled: () => boolean;
        init: () => Promise<boolean>;
        getAccount: () => Promise<any>;
        getBalance: (params: any) => Promise<any>;
        getNetworks: () => Promise<any>;
        signMessage: (params: any) => Promise<any>;
        invoke: (params: any) => Promise<any>;
      };
      Neon: {
        isInstalled: () => boolean;
        init: () => Promise<boolean>;
        getAccount: () => Promise<any>;
        getBalance: (params: any) => Promise<any>;
        getNetworks: () => Promise<any>;
        signMessage: (params: any) => Promise<any>;
        invoke: (params: any) => Promise<any>;
      };
      OneGate: {
        isInstalled: () => boolean;
        init: () => Promise<boolean>;
        getAccount: () => Promise<any>;
        getBalance: (params: any) => Promise<any>;
        getNetwork: () => Promise<any>;
        signMessage: (params: any) => Promise<any>;
        invoke: (params: any) => Promise<any>;
      };
      getInstalledWallets: () => any[];
    };
    NEOLineN3?: any;
    NEO?: any;
    neon?: any;
    OneGate?: any;
  }
}

type WalletType = 'neoline' | 'o3' | 'neon' | 'onegate';

export interface WalletAccount {
  address: string;
  label?: string;
  publicKey?: string;
}

export interface WalletProvider {
  name: string;
  type: WalletType;
  icon: string;
  installed: boolean;
  connect: () => Promise<WalletAccount>;
  getBalance: (address: string, assetId: string) => Promise<string>;
  getNetwork: () => Promise<{ chainId: number, networkMagic: number, nodeUrl: string }>;
  signMessage: (message: string, address: string) => Promise<{ publicKey: string, data: string, salt: string, message: string }>;
  signTransaction: (transaction: any) => Promise<{ txid: string, signatureData: string }>;
  invoke: (scriptHash: string, operation: string, args: any[], signers: any[]) => Promise<{ txid: string, nodeUrl: string }>;
}

interface NeoLineInterface {
  getAccount: () => Promise<any>;
  getBalance: (params: { address: string, assets: string[] }) => Promise<any>;
  getNetworks: () => Promise<any>;
  signMessage: (params: { message: string }) => Promise<any>;
  signTransaction: (params: any) => Promise<any>;
  invoke: (params: any) => Promise<any>;
}

interface O3Interface {
  REQUEST_METHOD: {
    GET_ACCOUNT: string;
    GET_BALANCE: string;
    SIGN_MESSAGE: string;
    INVOKE: string;
    NETWORK: string;
  };
  request: (method: string, params?: any) => Promise<any>;
}

interface NeonWalletInterface {
  getAccount: () => Promise<any>;
  getBalance: (params: any) => Promise<any>;
  getNetworks: () => Promise<any>;
  signMessage: (params: any) => Promise<any>;
  invoke: (params: any) => Promise<any>;
}

interface OneGateInterface {
  getAccount: () => Promise<any>;
  getNetwork: () => Promise<any>;
  getBalance: (params: any) => Promise<any>;
  signMessage: (params: any) => Promise<any>;
  invoke: (params: any) => Promise<any>;
}

// Check if NeoLine is installed
const checkNeoLine = (): boolean => {
  return typeof window !== 'undefined' && 
    (window.NEOLineN3 !== undefined || 
    (window.neoWalletAdapters !== undefined && 
     window.neoWalletAdapters.NeoLine !== undefined && 
     typeof window.neoWalletAdapters.NeoLine.isInstalled === 'function' && 
     window.neoWalletAdapters.NeoLine.isInstalled()));
};

// Check if O3 is installed
const checkO3 = (): boolean => {
  return typeof window !== 'undefined' && 
    ((window.NEO !== undefined && window.NEO.O3 !== undefined) || 
    (window.neoWalletAdapters !== undefined && 
     window.neoWalletAdapters.O3 !== undefined && 
     typeof window.neoWalletAdapters.O3.isInstalled === 'function' && 
     window.neoWalletAdapters.O3.isInstalled()));
};

// Check if Neon wallet is installed
const checkNeon = (): boolean => {
  return typeof window !== 'undefined' && 
    (window.neon !== undefined || 
    (window.neoWalletAdapters !== undefined && 
     window.neoWalletAdapters.Neon !== undefined && 
     typeof window.neoWalletAdapters.Neon.isInstalled === 'function' && 
     window.neoWalletAdapters.Neon.isInstalled()));
};

// Check if OneGate wallet is installed
const checkOneGate = (): boolean => {
  return typeof window !== 'undefined' && 
    (window.OneGate !== undefined || 
    (window.neoWalletAdapters !== undefined && 
     window.neoWalletAdapters.OneGate !== undefined && 
     typeof window.neoWalletAdapters.OneGate.isInstalled === 'function' && 
     window.neoWalletAdapters.OneGate.isInstalled()));
};

// NeoLine wallet provider
const getNeoLineProvider = (): WalletProvider => {
  const isInstalled = checkNeoLine();
  
  return {
    name: 'NeoLine',
    type: 'neoline',
    icon: '/images/wallets/neoline.svg',
    installed: isInstalled,
    
    connect: async () => {
      if (!isInstalled) {
        throw new Error('NeoLine is not installed');
      }
      
      await window.neoWalletAdapters?.NeoLine.init();
      const response = await window.neoWalletAdapters?.NeoLine.getAccount();
      
      return {
        address: response.address,
        label: response.label || undefined,
        publicKey: response.publicKey
      };
    },
    
    getBalance: async (address: string, assetId: string) => {
      if (!isInstalled) {
        throw new Error('NeoLine is not installed');
      }
      
      await window.neoWalletAdapters?.NeoLine.init();
      const response = await window.neoWalletAdapters?.NeoLine.getBalance({ 
        address, 
        assets: [assetId] 
      });
      
      // Find the asset in the response
      const asset = response.find((item: any) => item.assetId === assetId);
      return asset ? asset.amount : '0';
    },
    
    getNetwork: async () => {
      if (!isInstalled) {
        throw new Error('NeoLine is not installed');
      }
      
      await window.neoWalletAdapters?.NeoLine.init();
      const networks = await window.neoWalletAdapters?.NeoLine.getNetworks();
      
      return {
        chainId: networks.chainId,
        networkMagic: networks.networks[networks.defaultNetwork].magicNumber,
        nodeUrl: networks.networks[networks.defaultNetwork].rpcServer
      };
    },
    
    signMessage: async (message: string, address: string) => {
      if (!isInstalled) {
        throw new Error('NeoLine is not installed');
      }
      
      await window.neoWalletAdapters?.NeoLine.init();
      const result = await window.neoWalletAdapters?.NeoLine.signMessage({ message });
      
      return {
        publicKey: result.publicKey,
        data: result.signature,
        salt: result.salt || '',
        message
      };
    },
    
    signTransaction: async (transaction: any) => {
      if (!isInstalled) {
        throw new Error('NeoLine is not installed');
      }
      
      await window.neoWalletAdapters?.NeoLine.init();
      const result = await window.neoWalletAdapters?.NeoLine.signTransaction(transaction);
      
      return {
        txid: result.txid,
        signatureData: result.signatureData
      };
    },
    
    invoke: async (scriptHash: string, operation: string, args: any[], signers: any[]) => {
      if (!isInstalled) {
        throw new Error('NeoLine is not installed');
      }
      
      await window.neoWalletAdapters?.NeoLine.init();
      const result = await window.neoWalletAdapters?.NeoLine.invoke({
        scriptHash,
        operation,
        args,
        signers
      });
      
      return {
        txid: result.txid,
        nodeUrl: result.nodeUrl
      };
    }
  };
};

// O3 wallet provider
const getO3Provider = (): WalletProvider => {
  const isInstalled = checkO3();
  
  return {
    name: 'O3',
    type: 'o3',
    icon: '/images/wallets/o3.svg',
    installed: isInstalled,
    
    connect: async () => {
      if (!isInstalled) {
        throw new Error('O3 wallet is not installed');
      }
      
      const neo = (window as any).NEO;
      const result = await neo.O3.request(neo.O3.REQUEST_METHOD.GET_ACCOUNT);
      
      return {
        address: result.address,
        label: result.label || undefined,
        publicKey: result.publicKey
      };
    },
    
    getBalance: async (address: string, assetId: string) => {
      if (!isInstalled) {
        throw new Error('O3 wallet is not installed');
      }
      
      const neo = (window as any).NEO;
      const result = await neo.O3.request(neo.O3.REQUEST_METHOD.GET_BALANCE, {
        address,
        assets: [assetId]
      });
      
      // Find the asset in the response
      const asset = result.find((item: any) => item.assetId === assetId);
      return asset ? asset.amount : '0';
    },
    
    getNetwork: async () => {
      if (!isInstalled) {
        throw new Error('O3 wallet is not installed');
      }
      
      const neo = (window as any).NEO;
      const result = await neo.O3.request(neo.O3.REQUEST_METHOD.NETWORK);
      
      return {
        chainId: result.chainId,
        networkMagic: result.networkMagic,
        nodeUrl: result.nodeUrl
      };
    },
    
    signMessage: async (message: string, address: string) => {
      if (!isInstalled) {
        throw new Error('O3 wallet is not installed');
      }
      
      const neo = (window as any).NEO;
      const result = await neo.O3.request(neo.O3.REQUEST_METHOD.SIGN_MESSAGE, {
        message
      });
      
      return {
        publicKey: result.publicKey,
        data: result.signature,
        salt: result.salt || '',
        message
      };
    },
    
    signTransaction: async (transaction: any) => {
      if (!isInstalled) {
        throw new Error('O3 wallet is not installed');
      }
      
      const neo = (window as any).NEO;
      const result = await neo.O3.request(neo.O3.REQUEST_METHOD.SIGN_TRANSACTION, transaction);
      
      return {
        txid: result.txid,
        signatureData: result.signatureData
      };
    },
    
    invoke: async (scriptHash: string, operation: string, args: any[], signers: any[]) => {
      if (!isInstalled) {
        throw new Error('O3 wallet is not installed');
      }
      
      const neo = (window as any).NEO;
      const result = await neo.O3.request(neo.O3.REQUEST_METHOD.INVOKE, {
        scriptHash,
        operation,
        args,
        signers
      });
      
      return {
        txid: result.txid,
        nodeUrl: result.nodeUrl
      };
    }
  };
};

// Neon wallet provider
const getNeonProvider = (): WalletProvider => {
  const isInstalled = checkNeon();
  
  return {
    name: 'Neon',
    type: 'neon',
    icon: '/images/wallets/neon.svg',
    installed: isInstalled,
    
    connect: async () => {
      if (!isInstalled) {
        throw new Error('Neon wallet is not installed');
      }
      
      const result = await (window as any).neon.getAccount();
      
      return {
        address: result.address,
        label: result.label || undefined,
        publicKey: result.publicKey
      };
    },
    
    getBalance: async (address: string, assetId: string) => {
      if (!isInstalled) {
        throw new Error('Neon wallet is not installed');
      }
      
      const result = await (window as any).neon.getBalance({
        address,
        assets: [assetId]
      });
      
      // Find the asset in the response
      const asset = result.find((item: any) => item.assetId === assetId);
      return asset ? asset.amount : '0';
    },
    
    getNetwork: async () => {
      if (!isInstalled) {
        throw new Error('Neon wallet is not installed');
      }
      
      const networks = await (window as any).neon.getNetworks();
      
      return {
        chainId: networks.chainId,
        networkMagic: networks.networks[networks.defaultNetwork].magicNumber,
        nodeUrl: networks.networks[networks.defaultNetwork].rpcServer
      };
    },
    
    signMessage: async (message: string, address: string) => {
      if (!isInstalled) {
        throw new Error('Neon wallet is not installed');
      }
      
      const result = await (window as any).neon.signMessage({
        message
      });
      
      return {
        publicKey: result.publicKey,
        data: result.signature,
        salt: result.salt || '',
        message
      };
    },
    
    signTransaction: async (transaction: any) => {
      if (!isInstalled) {
        throw new Error('Neon wallet is not installed');
      }
      
      const result = await (window as any).neon.signTransaction(transaction);
      
      return {
        txid: result.txid,
        signatureData: result.signatureData
      };
    },
    
    invoke: async (scriptHash: string, operation: string, args: any[], signers: any[]) => {
      if (!isInstalled) {
        throw new Error('Neon wallet is not installed');
      }
      
      const result = await (window as any).neon.invoke({
        scriptHash,
        operation,
        args,
        signers
      });
      
      return {
        txid: result.txid,
        nodeUrl: result.nodeUrl || ''
      };
    }
  };
};

// OneGate wallet provider
const getOneGateProvider = (): WalletProvider => {
  const isInstalled = checkOneGate();
  
  return {
    name: 'OneGate',
    type: 'onegate',
    icon: '/images/wallets/onegate.svg',
    installed: isInstalled,
    
    connect: async () => {
      if (!isInstalled) {
        throw new Error('OneGate wallet is not installed');
      }
      
      const result = await (window as any).OneGate.getAccount();
      
      return {
        address: result.address,
        label: result.label || undefined,
        publicKey: result.publicKey
      };
    },
    
    getBalance: async (address: string, assetId: string) => {
      if (!isInstalled) {
        throw new Error('OneGate wallet is not installed');
      }
      
      const result = await (window as any).OneGate.getBalance({
        address,
        assets: [assetId]
      });
      
      // Find the asset in the response
      const asset = result.find((item: any) => item.assetId === assetId);
      return asset ? asset.amount : '0';
    },
    
    getNetwork: async () => {
      if (!isInstalled) {
        throw new Error('OneGate wallet is not installed');
      }
      
      const network = await (window as any).OneGate.getNetwork();
      
      return {
        chainId: network.chainId,
        networkMagic: network.networkMagic,
        nodeUrl: network.nodeUrl
      };
    },
    
    signMessage: async (message: string, address: string) => {
      if (!isInstalled) {
        throw new Error('OneGate wallet is not installed');
      }
      
      const result = await (window as any).OneGate.signMessage({
        message
      });
      
      return {
        publicKey: result.publicKey,
        data: result.signature,
        salt: result.salt || '',
        message
      };
    },
    
    signTransaction: async (transaction: any) => {
      if (!isInstalled) {
        throw new Error('OneGate wallet is not installed');
      }
      
      const result = await (window as any).OneGate.signTransaction(transaction);
      
      return {
        txid: result.txid,
        signatureData: result.signatureData
      };
    },
    
    invoke: async (scriptHash: string, operation: string, args: any[], signers: any[]) => {
      if (!isInstalled) {
        throw new Error('OneGate wallet is not installed');
      }
      
      const result = await (window as any).OneGate.invoke({
        scriptHash,
        operation,
        args,
        signers
      });
      
      return {
        txid: result.txid,
        nodeUrl: result.nodeUrl
      };
    }
  };
};

// Get all available wallet providers
export const getWalletProviders = (): WalletProvider[] => {
  return [
    getNeoLineProvider(),
    getO3Provider(),
    getNeonProvider(), 
    getOneGateProvider()
  ];
};

// Get a provider by type
export const getProviderByType = (type: WalletType): WalletProvider | undefined => {
  const providers = {
    neoline: getNeoLineProvider(),
    o3: getO3Provider(),
    neon: getNeonProvider(),
    onegate: getOneGateProvider()
  };
  
  return providers[type];
};

// Common asset IDs for Neo N3
export const NEO_ASSET_ID = '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5';
export const GAS_ASSET_ID = '0xd2a4cff31913016155e38e474a2c06d08be276cf'; 