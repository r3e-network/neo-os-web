import React from 'react';
import '@/app/globals.css';
import { Inter, Montserrat, JetBrains_Mono } from 'next/font/google';
import type { Metadata } from "next";
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Script from 'next/script';

export const metadata: Metadata = {
  title: "Neo N3 Service Layer - An Off-Chain Execution Environment for Blockchain",
  description: "Service layer for the Neo N3 blockchain, providing functions execution in TEE, contract automation, price feeds, and more.",
  keywords: "Neo N3, blockchain, oracle, trusted execution environment, TEE, smart contracts, automation",
};

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Base meta tags are handled by Next.js metadata */}
      </head>
      <body className="min-h-screen font-sans">
        {/* NeoLine wallet script */}
        <Script 
          src="https://cdn.jsdelivr.net/npm/neoline@latest/dist/neoline.min.js" 
          strategy="afterInteractive"
          id="neoline-script"
        />
        
        {/* O3 wallet script - Load both in sequence */}
        <Script 
          src="https://cdn.jsdelivr.net/npm/@o3-dapp/o3-dapi/lib/o3-dapi.min.js" 
          strategy="afterInteractive"
          id="o3-dapi-script"
        />
        <Script 
          src="https://cdn.jsdelivr.net/npm/@o3-dapp/neo3/lib/neo3.min.js" 
          strategy="afterInteractive"
          id="o3-neo3-script"
        />
        
        {/* Wallet adapters script - Load after wallet scripts */}
        <Script 
          src="/scripts/wallet-adapters.js" 
          strategy="afterInteractive"
          id="wallet-adapters-script"
        />
        
        <Header />
        <main className="pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}