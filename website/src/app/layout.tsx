import React from 'react';
import '@/app/globals.css';
import { Inter, Montserrat, JetBrains_Mono } from 'next/font/google';
import type { Metadata } from "next";
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: "Neo N3 Service Layer - A Trusted Execution Environment for Blockchain",
  description: "A centralized oracle service for the Neo N3 blockchain, providing functions execution in TEE, contract automation, price feeds, and more.",
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
        {/* NeoLine and other wallet scripts */}
        <script src="https://cdn.jsdelivr.net/npm/neoline@latest/dist/neoline.min.js" defer></script>
      </head>
      <body className="min-h-screen font-sans">
        <Header />
        <main className="pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}