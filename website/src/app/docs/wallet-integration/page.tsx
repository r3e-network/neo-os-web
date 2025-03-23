"use client";

import Link from 'next/link';
import Image from 'next/image';

export default function WalletIntegrationDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Neo N3 Wallet Integration</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          The Neo Service Layer provides seamless integration with popular Neo N3 wallets,
          allowing your applications to interact with the blockchain using user-owned wallets.
          This guide explains how to implement wallet integration in your applications.
        </p>
      </div>
      
      <h2>Supported Wallets</h2>
      <p>
        The Neo Service Layer supports the following Neo N3 wallets:
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 my-8">
        <div className="flex flex-col items-center p-4 border rounded-lg">
          <Image src="/images/wallets/neoline.png" width={64} height={64} alt="NeoLine" className="mb-2" />
          <h3 className="text-lg font-medium mb-1">NeoLine</h3>
          <a href="https://neoline.io/" target="_blank" rel="noopener noreferrer" className="text-primary text-sm">
            Website →
          </a>
        </div>
        
        <div className="flex flex-col items-center p-4 border rounded-lg">
          <Image src="/images/wallets/o3.png" width={64} height={64} alt="O3" className="mb-2" />
          <h3 className="text-lg font-medium mb-1">O3</h3>
          <a href="https://o3.network/" target="_blank" rel="noopener noreferrer" className="text-primary text-sm">
            Website →
          </a>
        </div>
        
        <div className="flex flex-col items-center p-4 border rounded-lg">
          <Image src="/images/wallets/neon.png" width={64} height={64} alt="Neon" className="mb-2" />
          <h3 className="text-lg font-medium mb-1">Neon</h3>
          <a href="https://neonwallet.com/" target="_blank" rel="noopener noreferrer" className="text-primary text-sm">
            Website →
          </a>
        </div>
        
        <div className="flex flex-col items-center p-4 border rounded-lg">
          <Image src="/images/wallets/onegate.png" width={64} height={64} alt="OneGate" className="mb-2" />
          <h3 className="text-lg font-medium mb-1">OneGate</h3>
          <a href="https://onegate.space/" target="_blank" rel="noopener noreferrer" className="text-primary text-sm">
            Website →
          </a>
        </div>
      </div>
      
      <h2>Integration Methods</h2>
      <p>
        There are two ways to integrate Neo N3 wallets into your application using the Neo Service Layer:
      </p>
      
      <h3>1. Using the WalletConnect Component</h3>
      <p>
        The simplest way is to use the provided <code>WalletConnect</code> component:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`import WalletConnect from '@/components/WalletConnect';

function MyComponent() {
  const handleConnect = (provider, account) => {
    console.log('Connected to wallet:', provider.name);
    console.log('Account address:', account.address);
    // Store the connected account or perform actions
  };
  
  const handleDisconnect = () => {
    console.log('Wallet disconnected');
    // Clear stored account information
  };
  
  return (
    <div>
      <h1>My Application</h1>
      <WalletConnect 
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
}`}
      </pre>
      
      <h3>2. Using the useWallet Hook</h3>
      <p>
        For more advanced integration, use the <code>useWallet</code> hook:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`import { useWallet } from '@/lib/hooks/useWallet';

function MyWalletComponent() {
  const [
    { provider, account, balances, isConnecting, error },
    { connect, disconnect, refreshBalances, signMessage, invokeContract }
  ] = useWallet();
  
  const handleSignMessage = async () => {
    const message = "Hello, Neo!";
    const signature = await signMessage(message);
    console.log("Signature:", signature);
  };
  
  const handleInvokeContract = async () => {
    const result = await invokeContract(
      "0x7a16a1f5c40e69790333f3bfe7e4325a08cc2f79", // scriptHash
      "transfer",                                     // operation
      [                                               // arguments
        { type: "Hash160", value: account.address },
        { type: "Hash160", value: "NhGomBpYnKXArr55nHRQ5rzy79TwKVXZbr" },
        { type: "Integer", value: "100000000" }
      ],
      [                                               // signers
        { account: account.address, scopes: "CalledByEntry" }
      ]
    );
    
    console.log("Transaction ID:", result?.txid);
  };
  
  return (
    <div>
      {account ? (
        <div>
          <p>Connected to {provider.name}</p>
          <p>Address: {account.address}</p>
          {balances && (
            <div>
              <p>NEO Balance: {balances.neo}</p>
              <p>GAS Balance: {balances.gas}</p>
            </div>
          )}
          <button onClick={handleSignMessage}>Sign Message</button>
          <button onClick={handleInvokeContract}>Invoke Contract</button>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      ) : (
        <button onClick={() => connect()} disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}`}
      </pre>
      
      <h2>Key Features</h2>
      
      <h3>1. Wallet Detection</h3>
      <p>
        The wallet integration automatically detects installed Neo N3 wallets and provides a dropdown menu for users to select their preferred wallet.
      </p>
      
      <h3>2. Account Information</h3>
      <p>
        Once connected, you can access the user's wallet address and label (if available).
      </p>
      
      <h3>3. Balance Checking</h3>
      <p>
        Retrieve NEO and GAS balances for the connected account.
      </p>
      
      <h3>4. Message Signing</h3>
      <p>
        Request the user to sign messages for authentication or verification purposes.
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`// Using the useWallet hook
const [_, { signMessage }] = useWallet();

// Request user to sign a message
const signature = await signMessage("Verify your identity for Neo Service Layer");

// signature object contains:
// {
//   publicKey: "03c7a5b227...",
//   data: "f1e59f25b0...",
//   salt: "d9616db9e3..."
//   message: "Verify your identity for Neo Service Layer"
// }`}
      </pre>
      
      <h3>5. Contract Invocation</h3>
      <p>
        Invoke smart contract methods on the Neo N3 blockchain with user approval.
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`// Using the useWallet hook
const [{ account }, { invokeContract }] = useWallet();

// Invoke a token transfer
const result = await invokeContract(
  "0x7a16a1f5c40e69790333f3bfe7e4325a08cc2f79",  // Token contract hash
  "transfer",                                     // Method name
  [                                               // Arguments
    { type: "Hash160", value: account.address },  // From
    { type: "Hash160", value: "Nb94dB266iD7JtXs3PmpQi6q7jKR4iQGpC" }, // To
    { type: "Integer", value: "100000000" }       // Amount (1 token with 8 decimals)
  ],
  [                                               // Transaction signers
    { account: account.address, scopes: "CalledByEntry" }
  ]
);

// result contains:
// {
//   txid: "0x9c57c0a94e87c690ebd4d4e12e1f731c181d889b7bc5f0e7ec8f13383a699073",
//   nodeUrl: "https://rpc.neo.org:443"
// }`}
      </pre>
      
      <h3>6. Network Information</h3>
      <p>
        Retrieve information about the connected network, such as chain ID and magic number.
      </p>
      
      <h2>Best Practices</h2>
      
      <h3>Persist Connection State</h3>
      <p>
        The wallet integration automatically persists connection state using <code>localStorage</code>, allowing users to remain connected after page reloads.
      </p>
      
      <h3>Error Handling</h3>
      <p>
        Always handle possible errors when interacting with wallets:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`try {
  await connect();
  // Successfully connected
} catch (error) {
  // Handle connection errors
  console.error("Failed to connect wallet:", error);
  
  // Show user-friendly error message
  if (error.message.includes("User rejected")) {
    // User rejected the connection request
  } else if (!isWalletInstalled) {
    // Wallet not installed
  } else {
    // Other errors
  }
}`}
      </pre>
      
      <h3>User Experience</h3>
      <ul>
        <li>Clearly indicate when a wallet is connected or disconnected</li>
        <li>Display the connected wallet type and a shortened version of the address</li>
        <li>Provide a way for users to disconnect their wallet</li>
        <li>Show loading states during wallet operations</li>
      </ul>
      
      <h2>Security Considerations</h2>
      
      <h3>Never Store Private Keys</h3>
      <p>
        The wallet integration never exposes or requires access to private keys. All sensitive operations are handled securely by the wallet software.
      </p>
      
      <h3>Transaction Safety</h3>
      <p>
        Always provide clear information about what a transaction will do before requesting a user to sign it. Never automatically sign transactions without user approval.
      </p>
      
      <h3>Network Validation</h3>
      <p>
        Verify that the user is connected to the expected network (MainNet, TestNet, etc.) before executing transactions.
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`const [{ provider }] = useWallet();

const validateNetwork = async () => {
  const network = await provider.getNetwork();
  
  // Check if on MainNet (networkMagic 860833102)
  if (network.networkMagic !== 860833102) {
    alert("Please connect to Neo N3 MainNet to continue.");
    return false;
  }
  
  return true;
}`}
      </pre>
      
      <h2>Example Integration</h2>
      <p>
        Check out the <Link href="/playground" className="text-primary hover:underline">Playground</Link> for a live example of wallet integration. The "Wallet Connection" tab demonstrates how to use the <code>WalletConnect</code> component and perform wallet operations.
      </p>
      
      <h2>API Reference</h2>
      
      <h3>WalletConnect Component Props</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`interface WalletConnectProps {
  // Called when a wallet is successfully connected
  onConnect?: (provider: WalletProvider, account: WalletAccount) => void;
  
  // Called when the user disconnects their wallet
  onDisconnect?: () => void;
  
  // Optional CSS classes
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
}`}
      </pre>
      
      <h3>useWallet Hook Return Value</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`// State object
interface WalletState {
  provider: WalletProvider | null;   // Current wallet provider
  account: WalletAccount | null;     // Connected account information
  balances: {                       // NEO and GAS balances
    neo: string;
    gas: string;
  } | null;
  isConnecting: boolean;            // True during connection process
  error: string | null;             // Error message if any
}

// Utilities object
interface WalletUtilities {
  connect: (providerType?: string) => Promise<void>;
  disconnect: () => void;
  refreshBalances: () => Promise<void>;
  signMessage: (message: string) => Promise<SignatureResult | null>;
  invokeContract: (
    scriptHash: string,
    operation: string,
    args: any[],
    signers: any[]
  ) => Promise<InvocationResult | null>;
}`}
      </pre>
      
      <h2>Next Steps</h2>
      <ul>
        <li><Link href="/docs/services/gas-bank" className="text-primary hover:underline">Gas Bank Service Documentation</Link></li>
        <li><Link href="/docs/services/functions" className="text-primary hover:underline">Functions Service Documentation</Link></li>
        <li><Link href="/playground" className="text-primary hover:underline">Try the Interactive Playground</Link></li>
      </ul>
    </div>
  );
} 