import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wallet Connection Troubleshooting - Neo N3 Service Layer',
  description: 'Troubleshooting guide for wallet connection issues with the Neo N3 Service Layer',
};

export default function WalletTroubleshooting() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Wallet Connection Troubleshooting</h1>
      <p className="text-gray-600 mb-8">Solutions to common wallet connection issues</p>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Common Wallet Connection Issues</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">Wallet Not Detected</h3>
          <p className="mb-3">If your wallet is installed but not detected by the website:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Reload the page</strong> - Sometimes wallet extensions need a page refresh to be detected</li>
            <li><strong>Check extension status</strong> - Ensure the wallet extension is enabled and up to date</li>
            <li><strong>Browser compatibility</strong> - Make sure you&apos;re using a supported browser (Chrome recommended for NeoLine)</li>
            <li><strong>Console errors</strong> - Check browser console for any error messages (right-click &gt; Inspect &gt; Console)</li>
          </ul>
        </div>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">Connection Failed</h3>
          <p className="mb-3">If connecting to a wallet fails:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Unlock the wallet</strong> - Make sure the wallet is unlocked and accessible</li>
            <li><strong>Network settings</strong> - Ensure the wallet is connected to the correct Neo N3 network</li>
            <li><strong>Multiple attempts</strong> - The website will automatically retry the connection up to 3 times</li>
            <li><strong>Extension permissions</strong> - Make sure the wallet extension has permission to interact with this site</li>
          </ul>
        </div>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">Balance Issues</h3>
          <p className="mb-3">If wallet balances are not displaying correctly:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Refresh balances</strong> - Use the &quot;Refresh Balances&quot; button in the wallet dropdown</li>
            <li><strong>Network mismatch</strong> - Check if the wallet is on the same network as the website</li>
            <li><strong>Asset IDs</strong> - Verify the NEO and GAS asset IDs are correct</li>
            <li><strong>Sync status</strong> - Your wallet may not be fully synced with the blockchain</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Wallet Specific Issues</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">NeoLine</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Make sure you&apos;re using the NeoLine N3 version, not the legacy Neo2 version</li>
            <li>Check if you need to approve the connection request in the extension popup</li>
            <li>Try reinstalling the extension if persistent issues occur</li>
          </ul>
        </div>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">O3 Wallet</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Ensure you have the latest version of O3 desktop or mobile app</li>
            <li>For desktop, make sure the app is running before trying to connect</li>
            <li>For mobile, verify you&apos;re using the correct dApp browser within O3</li>
          </ul>
        </div>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">Other Wallets</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Ensure the wallet supports Neo N3 (not just Neo Legacy)</li>
            <li>Check if the wallet has dApp browser or web3 connectivity features enabled</li>
            <li>Consult wallet-specific documentation for connection troubleshooting</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Advanced Troubleshooting</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">Clearing Browser Data</h3>
          <p className="mb-3">If you&apos;re experiencing persistent issues, try clearing your browser data:</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Open your browser settings</li>
            <li>Find &quot;Clear browsing data&quot; or similar option</li>
            <li>Select &quot;Cookies and site data&quot; and &quot;Cached images and files&quot;</li>
            <li>Choose to clear data for &quot;neo-service-layer.com&quot; or for all sites</li>
            <li>Reload the page and try connecting again</li>
          </ol>
        </div>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">Browser Console Debugging</h3>
          <p className="mb-3">For developers or advanced users, check the browser console:</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Right-click on the page and select &quot;Inspect&quot; or press F12</li>
            <li>Go to the &quot;Console&quot; tab</li>
            <li>Look for errors related to wallet connections</li>
            <li>Check if wallet adapters are properly initialized</li>
            <li>Verify if wallet objects (NEOLineN3, NEO.O3, etc.) are present in the window object</li>
          </ol>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Still Having Issues?</h2>
        <p className="mb-4">
          If you&apos;ve tried all the steps above and are still experiencing connection issues, please contact our support team
          with the following information:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Browser type and version</li>
          <li>Wallet type and version</li>
          <li>Operating system</li>
          <li>Any error messages from the console</li>
          <li>Steps to reproduce the issue</li>
        </ul>
        <p className="mt-4">
          <a 
            href="/contact" 
            className="text-primary hover:text-primary-dark underline"
          >
            Contact Support
          </a>
        </p>
      </section>
    </div>
  );
} 