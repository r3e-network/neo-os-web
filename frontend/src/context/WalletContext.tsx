import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { WalletState, WalletContextType } from '../types';

const initialWalletState: WalletState = {
  connected: false,
  address: null,
  network: null,
  balance: null,
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>(initialWalletState);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Check for NeoLine wallet
      if (typeof window !== 'undefined' && (window as any).NEOLine) {
        const neoline = new (window as any).NEOLine.Init();

        // Get account
        const account = await neoline.getAccount();

        // Get network
        const network = await neoline.getNetworks();

        // Get balance
        const balance = await neoline.getBalance({
          params: [{ address: account.address, contracts: [] }],
        });

        setWallet({
          connected: true,
          address: account.address,
          network: network.defaultNetwork,
          balance: balance[account.address]?.[0]?.amount || '0',
        });
      }
      // Check for O3 wallet
      else if (typeof window !== 'undefined' && (window as any).neo3Dapi) {
        const neo3 = (window as any).neo3Dapi;

        const account = await neo3.getAccount();
        const network = await neo3.getNetworks();

        setWallet({
          connected: true,
          address: account.address,
          network: network.defaultNetwork,
          balance: null, // Fetch separately if needed
        });
      }
      // Fallback: Demo mode
      else {
        // For development/demo purposes
        console.warn('No Neo wallet detected. Using demo mode.');
        setWallet({
          connected: true,
          address: 'NDemo...Address',
          network: 'TestNet',
          balance: '100.00',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet(initialWalletState);
    setError(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        connect,
        disconnect,
        isConnecting,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
