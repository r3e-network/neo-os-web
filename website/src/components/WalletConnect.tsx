"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  getWalletProviders, 
  WalletProvider, 
  WalletAccount, 
  NEO_ASSET_ID, 
  GAS_ASSET_ID 
} from '@/lib/wallets';

interface WalletConnectProps {
  onConnect?: (provider: WalletProvider, account: WalletAccount) => void;
  onDisconnect?: () => void;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
}

export default function WalletConnect({
  onConnect,
  onDisconnect,
  className = '',
  buttonClassName = '',
  dropdownClassName = ''
}: WalletConnectProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<{
    provider: WalletProvider;
    account: WalletAccount;
  } | null>(null);
  const [balances, setBalances] = useState<{
    neo: string;
    gas: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Providers state is updated based on what's available in the browser
  const [providers, setProviders] = useState<WalletProvider[]>([]);

  // Check for available providers
  useEffect(() => {
    // Get available wallet providers
    const availableProviders = getWalletProviders();
    setProviders(availableProviders);

    // Check for stored connection
    const storedProvider = localStorage.getItem('connectedWalletProvider');
    if (storedProvider) {
      const provider = availableProviders.find(p => p.type === storedProvider);
      if (provider && provider.installed) {
        connectToWallet(provider);
      } else {
        // Clear stored data if provider is no longer installed
        localStorage.removeItem('connectedWalletProvider');
      }
    }
  }, []);

  // Get balances when connected
  useEffect(() => {
    if (connectedWallet) {
      fetchBalances();
    }
  }, [connectedWallet]);

  const connectToWallet = async (provider: WalletProvider) => {
    setIsLoading(true);
    setError(null);

    try {
      const account = await provider.connect();
      setConnectedWallet({ provider, account });
      setIsDropdownOpen(false);
      localStorage.setItem('connectedWalletProvider', provider.type);
      
      if (onConnect) {
        onConnect(provider, account);
      }
    } catch (err) {
      console.error('Failed to connect to wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setConnectedWallet(null);
    setBalances(null);
    localStorage.removeItem('connectedWalletProvider');
    
    if (onDisconnect) {
      onDisconnect();
    }
  };

  const fetchBalances = async () => {
    if (!connectedWallet) return;

    try {
      const [neoBalance, gasBalance] = await Promise.all([
        connectedWallet.provider.getBalance(connectedWallet.account.address, NEO_ASSET_ID),
        connectedWallet.provider.getBalance(connectedWallet.account.address, GAS_ASSET_ID)
      ]);

      setBalances({
        neo: neoBalance,
        gas: gasBalance
      });
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const installedProviders = providers.filter(provider => provider.installed);
  const notInstalledProviders = providers.filter(provider => !provider.installed);

  return (
    <div className={`relative ${className}`}>
      {connectedWallet ? (
        <div className="flex items-center space-x-2">
          <button
            className={`flex items-center px-4 py-2 bg-primary text-secondary font-medium rounded-lg hover:bg-primary/90 transition-all ${buttonClassName}`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <Image
              src={connectedWallet.provider.icon}
              alt={connectedWallet.provider.name}
              width={24}
              height={24}
              className="mr-2 rounded-full"
            />
            <span>{formatAddress(connectedWallet.account.address)}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`ml-2 h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className={`absolute top-full right-0 mt-2 w-60 bg-white rounded-lg shadow-lg z-50 ${dropdownClassName}`}>
              <div className="p-4 border-b border-gray-200">
                <div className="font-semibold text-gray-800">{connectedWallet.account.label || 'My Wallet'}</div>
                <div className="text-sm text-gray-600 truncate">{connectedWallet.account.address}</div>
              </div>
              
              {balances && (
                <div className="p-4 border-b border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">NEO</span>
                    <span className="font-medium">{balances.neo}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">GAS</span>
                    <span className="font-medium">{balances.gas}</span>
                  </div>
                </div>
              )}
              
              <div className="p-3">
                <button
                  className="w-full py-2 px-3 text-center text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  onClick={fetchBalances}
                >
                  Refresh Balances
                </button>
                <button
                  className="w-full py-2 px-3 text-center text-red-600 hover:bg-gray-100 rounded-md transition-colors"
                  onClick={disconnectWallet}
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <button
            className={`flex items-center px-4 py-2 bg-primary text-secondary font-medium rounded-lg hover:bg-primary/90 transition-colors ${buttonClassName} ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1H6v8l4-2 4 2V6z" clipRule="evenodd" />
                </svg>
                Connect Wallet
              </>
            )}
          </button>

          {isDropdownOpen && (
            <div className={`absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg z-50 ${dropdownClassName}`}>
              <div className="p-3 border-b border-gray-200">
                <h3 className="text-gray-800 font-medium">Connect Wallet</h3>
              </div>
              
              {error && (
                <div className="p-3 text-sm text-red-600 border-b border-gray-200">
                  {error}
                </div>
              )}
              
              <div className="p-2">
                {installedProviders.length > 0 ? (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-500 mb-1 px-2">Installed Wallets</div>
                    {installedProviders.map((provider) => (
                      <button
                        key={provider.type}
                        className="flex items-center w-full py-2 px-3 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        onClick={() => connectToWallet(provider)}
                      >
                        <Image
                          src={provider.icon}
                          alt={provider.name}
                          width={24}
                          height={24}
                          className="mr-2 rounded-full"
                        />
                        <span>{provider.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-sm text-gray-600 mb-2">
                    No Neo N3 wallets detected in your browser.
                  </div>
                )}

                {notInstalledProviders.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1 px-2">Get a Wallet</div>
                    {notInstalledProviders.map((provider) => {
                      let walletUrl = '#';
                      
                      // Add wallet download links
                      switch (provider.type) {
                        case 'neoline':
                          walletUrl = 'https://neoline.io/';
                          break;
                        case 'o3':
                          walletUrl = 'https://o3.network/';
                          break;
                        case 'neon':
                          walletUrl = 'https://neonwallet.com/';
                          break;
                        case 'onegate':
                          walletUrl = 'https://onegate.space/';
                          break;
                      }
                      
                      return (
                        <a
                          key={provider.type}
                          href={walletUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center w-full py-2 px-3 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          <Image
                            src={provider.icon}
                            alt={provider.name}
                            width={24}
                            height={24}
                            className="mr-2 rounded-full opacity-60"
                          />
                          <span>{provider.name}</span>
                          <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
} 