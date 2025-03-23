"use client";

import { useState, useEffect } from 'react';
import { 
  getWalletProviders, 
  WalletProvider, 
  WalletAccount, 
  NEO_ASSET_ID,
  GAS_ASSET_ID 
} from '@/lib/wallets';
import WalletConnect from '@/components/WalletConnect';

interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export default function WalletExample() {
  const [connectedWallet, setConnectedWallet] = useState<{
    provider: WalletProvider;
    account: WalletAccount;
  } | null>(null);
  
  const [functionResult, setFunctionResult] = useState<FunctionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const handleConnect = (provider: WalletProvider, account: WalletAccount) => {
    setConnectedWallet({ provider, account });
    setFunctionResult(null);
  };
  
  const handleDisconnect = () => {
    setConnectedWallet(null);
    setFunctionResult(null);
  };
  
  const executeExampleFunction = async () => {
    if (!connectedWallet) return;
    
    setIsExecuting(true);
    setFunctionResult(null);
    
    try {
      const { provider, account } = connectedWallet;
      
      // Get balance information
      const [neoBalance, gasBalance] = await Promise.all([
        provider.getBalance(account.address, NEO_ASSET_ID),
        provider.getBalance(account.address, GAS_ASSET_ID)
      ]);
      
      // Get network information
      const network = await provider.getNetwork();
      
      // Sign a simple message
      const message = "Hello from Neo Service Layer!";
      const signature = await provider.signMessage(message, account.address);
      
      setFunctionResult({
        success: true,
        data: {
          wallet: provider.name,
          address: account.address,
          balances: {
            NEO: neoBalance,
            GAS: gasBalance
          },
          network: {
            chainId: network.chainId,
            networkMagic: network.networkMagic,
            nodeUrl: network.nodeUrl
          },
          signature: {
            message,
            signatureData: signature.data.substring(0, 20) + '...',
            publicKey: signature.publicKey.substring(0, 20) + '...'
          }
        }
      });
    } catch (err) {
      console.error('Error executing wallet function:', err);
      setFunctionResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error during wallet operation'
      });
    } finally {
      setIsExecuting(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-secondary text-white p-4">
        <h2 className="text-xl font-semibold">Neo N3 Wallet Example</h2>
        <p className="text-sm text-gray-300">
          Connect your Neo N3 wallet to interact with blockchain functions
        </p>
      </div>
      
      <div className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Connect Your Wallet</h3>
            <p className="text-gray-600 text-sm">
              Use the wallet connector to connect your NeoLine, O3, or other Neo N3 wallet
            </p>
          </div>
          
          <WalletConnect 
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>
        
        {connectedWallet ? (
          <div className="mt-6">
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="flex flex-col md:flex-row justify-between mb-2">
                <span className="text-gray-600 font-medium">Connected Wallet:</span>
                <span className="font-medium">{connectedWallet.provider.name}</span>
              </div>
              <div className="flex flex-col md:flex-row justify-between">
                <span className="text-gray-600 font-medium">Address:</span>
                <span className="font-mono text-sm break-all">{connectedWallet.account.address}</span>
              </div>
            </div>
            
            <button
              className={`w-full py-3 rounded-lg font-medium transition-all ${
                isExecuting 
                  ? 'bg-gray-300 cursor-not-allowed text-gray-600' 
                  : 'bg-primary text-secondary hover:bg-primary/90'
              }`}
              onClick={executeExampleFunction}
              disabled={isExecuting}
            >
              {isExecuting ? 'Executing...' : 'Execute Wallet Function'}
            </button>
            
            {functionResult && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Result</h3>
                {functionResult.success ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="mb-2 text-green-600 font-medium">Success</div>
                    <pre className="bg-white p-4 rounded-md overflow-auto text-sm">
                      {JSON.stringify(functionResult.data, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="mb-2 text-red-600 font-medium">Error</div>
                    <pre className="bg-white p-4 rounded-md overflow-auto text-sm text-red-600">
                      {functionResult.error}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 p-6 rounded-lg text-center">
            <p className="text-gray-600">
              Connect your wallet to execute blockchain functions
            </p>
          </div>
        )}
        
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold mb-3">About Wallet Integration</h3>
          <p className="text-gray-600 mb-4">
            The Neo Service Layer provides seamless integration with popular Neo N3 wallets,
            allowing your dApps to:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Connect to user wallets securely</li>
            <li>Read blockchain data and account balances</li>
            <li>Sign messages for authentication</li>
            <li>Execute smart contract functions</li>
            <li>Invoke blockchain transactions</li>
          </ul>
          <p className="text-gray-600 mt-4">
            Check out the <a href="/docs/wallet-integration" className="text-primary hover:underline">Wallet Integration Documentation</a> for more details.
          </p>
        </div>
      </div>
    </div>
  );
} 