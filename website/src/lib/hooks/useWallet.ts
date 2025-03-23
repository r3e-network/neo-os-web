"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  getWalletProviders, 
  WalletProvider, 
  WalletAccount, 
  NEO_ASSET_ID,
  GAS_ASSET_ID,
  getProviderByType
} from '@/lib/wallets';

export interface WalletState {
  provider: WalletProvider | null;
  account: WalletAccount | null;
  balances: {
    neo: string;
    gas: string;
  } | null;
  isConnecting: boolean;
  error: string | null;
}

export interface WalletUtilities {
  connect: (providerType?: string) => Promise<void>;
  disconnect: () => void;
  refreshBalances: () => Promise<void>;
  signMessage: (message: string) => Promise<{ publicKey: string, data: string, salt: string, message: string } | null>;
  invokeContract: (scriptHash: string, operation: string, args: any[], signers: any[]) => Promise<{ txid: string, nodeUrl: string } | null>;
}

export function useWallet(): [WalletState, WalletUtilities] {
  const [state, setState] = useState<WalletState>({
    provider: null,
    account: null,
    balances: null,
    isConnecting: false,
    error: null
  });
  
  // Load wallet from localStorage on mount
  useEffect(() => {
    const storedProvider = localStorage.getItem('connectedWalletProvider');
    if (storedProvider) {
      const provider = getProviderByType(storedProvider as any);
      if (provider && provider.installed) {
        connect(provider.type);
      } else {
        // Clear stored data if provider is no longer installed
        localStorage.removeItem('connectedWalletProvider');
      }
    }
  }, []);
  
  const connect = useCallback(async (providerType?: string) => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      // Get the provider to connect to
      let provider: WalletProvider | undefined;
      
      if (providerType) {
        // Connect to specific provider if specified
        provider = getProviderByType(providerType as any);
      } else {
        // Otherwise, use the first installed provider
        const providers = getWalletProviders();
        provider = providers.find(p => p.installed);
      }
      
      if (!provider) {
        throw new Error('No compatible wallet provider found');
      }
      
      // Maximum number of retries
      const maxRetries = 3;
      let retries = 0;
      let account: WalletAccount | null = null;
      
      while (retries < maxRetries && !account) {
        try {
          if (retries > 0) {
            console.log(`Retrying wallet connection (attempt ${retries + 1}/${maxRetries})...`);
          }
          
          // Connect to the wallet
          account = await provider.connect();
        } catch (error) {
          retries++;
          
          if (retries >= maxRetries) {
            console.error('Failed to connect wallet after multiple attempts:', error);
            throw error; // Rethrow to be caught by the outer try/catch
          } else {
            // Wait before trying again
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (!account) {
        throw new Error('Failed to connect to wallet');
      }
      
      // Save provider type to localStorage
      localStorage.setItem('connectedWalletProvider', provider.type);
      
      // Update state
      setState(prev => ({
        ...prev,
        provider,
        account,
        isConnecting: false,
        error: null
      }));
      
      // Get balances
      refreshBalances(provider, account);
      
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: err instanceof Error ? err.message : 'Unknown error connecting to wallet'
      }));
    }
  }, []);
  
  const disconnect = useCallback(() => {
    localStorage.removeItem('connectedWalletProvider');
    setState({
      provider: null,
      account: null,
      balances: null,
      isConnecting: false,
      error: null
    });
  }, []);
  
  const refreshBalances = useCallback(async (
    providerToUse?: WalletProvider,
    accountToUse?: WalletAccount
  ) => {
    const provider = providerToUse || state.provider;
    const account = accountToUse || state.account;
    
    if (!provider || !account) return;
    
    try {
      const [neoBalance, gasBalance] = await Promise.all([
        provider.getBalance(account.address, NEO_ASSET_ID),
        provider.getBalance(account.address, GAS_ASSET_ID)
      ]);
      
      setState(prev => ({
        ...prev,
        balances: {
          neo: neoBalance,
          gas: gasBalance
        }
      }));
    } catch (err) {
      console.error('Failed to refresh balances:', err);
      // Don't update error state, just log to console
    }
  }, [state.provider, state.account]);
  
  const signMessage = useCallback(async (message: string) => {
    if (!state.provider || !state.account) return null;
    
    try {
      const signature = await state.provider.signMessage(
        message,
        state.account.address
      );
      return signature;
    } catch (err) {
      console.error('Failed to sign message:', err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to sign message'
      }));
      return null;
    }
  }, [state.provider, state.account]);
  
  const invokeContract = useCallback(async (
    scriptHash: string,
    operation: string,
    args: any[],
    signers: any[]
  ) => {
    if (!state.provider || !state.account) return null;
    
    try {
      const result = await state.provider.invoke(
        scriptHash,
        operation,
        args,
        signers
      );
      return result;
    } catch (err) {
      console.error('Failed to invoke contract:', err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to invoke contract'
      }));
      return null;
    }
  }, [state.provider, state.account]);
  
  return [
    state,
    {
      connect,
      disconnect,
      refreshBalances: () => refreshBalances(),
      signMessage,
      invokeContract
    }
  ];
} 