"use client";

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

// Feature cards data
const features = [
  {
    title: 'Functions Service',
    description: 'Execute JavaScript functions securely in a Trusted Execution Environment (TEE).',
    icon: '📦',
    href: '/features#functions',
  },
  {
    title: 'Secret Management',
    description: 'Store and use sensitive data with enterprise-grade security.',
    icon: '🔐',
    href: '/features#secrets',
  },
  {
    title: 'Contract Automation',
    description: 'Automate smart contract execution based on events and triggers.',
    icon: '⚙️',
    href: '/features#automation',
  },
  {
    title: 'Gas Bank',
    description: 'Efficient gas management for service operations.',
    icon: '⛽',
    href: '/features#gas-bank',
  },
  {
    title: 'Random Number',
    description: 'Generate secure random numbers for your smart contracts.',
    icon: '🎲',
    href: '/features#random',
  },
  {
    title: 'Price Feed',
    description: 'Get reliable token price updates for your DeFi applications.',
    icon: '💹',
    href: '/features#price-feed',
  },
];

export default function Home() {
  return (
    <div className="bg-gray-50">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-r from-secondary to-secondary/90 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
            <motion.div 
              className="lg:w-1/2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                <span className="text-primary">Trusted</span> Execution Environment for Neo N3 Blockchain
              </h1>
              <p className="text-lg md:text-xl mb-8 text-gray-200">
                A centralized oracle service providing secure function execution, contract automation, price feeds, and more for the Neo N3 ecosystem.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/docs/getting-started" className="btn btn-primary">
                  Get Started
                </Link>
                <Link href="/playground" className="btn btn-outline border-white text-white hover:bg-white hover:text-secondary">
                  Try Playground
                </Link>
              </div>
            </motion.div>
            <motion.div 
              className="lg:w-1/2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="relative w-full h-[400px] rounded-lg overflow-hidden shadow-xl">
                {/* Replace with actual hero image */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-white text-opacity-80">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🚀</div>
                    <div className="text-xl">Neo N3 Service Layer</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powerful <span className="text-primary">Services</span> for Neo N3 Developers
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              The Service Layer provides a suite of tools that enhance the capabilities of smart contracts on the Neo N3 blockchain.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="card hover:shadow-lg transition-shadow duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * index }}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                <Link href={feature.href} className="text-primary font-semibold hover:underline">
                  Learn more →
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It <span className="text-primary">Works</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              The Service Layer uses Azure Confidential Computing to provide a secure and reliable execution environment for blockchain operations.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
            <div className="lg:w-1/2 order-2 lg:order-1">
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-full flex items-center justify-center text-secondary font-bold text-xl">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Upload Your JavaScript Function</h3>
                    <p className="text-gray-600">
                      Create and upload your JavaScript functions through our API or web dashboard.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-full flex items-center justify-center text-secondary font-bold text-xl">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Secure Execution in TEE</h3>
                    <p className="text-gray-600">
                      Your code runs in a Trusted Execution Environment, isolated from other processes and protected from unauthorized access.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-full flex items-center justify-center text-secondary font-bold text-xl">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Interact with Neo N3 Blockchain</h3>
                    <p className="text-gray-600">
                      The Service Layer handles blockchain interactions, including transaction creation, signing, and monitoring.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-full flex items-center justify-center text-secondary font-bold text-xl">
                    4
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Automated Triggers & Events</h3>
                    <p className="text-gray-600">
                      Set up triggers to automate function execution based on blockchain events, time, or external data.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:w-1/2 order-1 lg:order-2">
              <div className="relative w-full h-[500px] rounded-lg overflow-hidden shadow-xl">
                {/* Replace with actual "How It Works" illustration */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-primary/10 flex items-center justify-center">
                  <div className="text-center text-gray-600">
                    <div className="text-6xl mb-4">🔄</div>
                    <div className="text-xl">Service Layer Architecture</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-secondary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Build on Neo N3 <span className="text-primary">Service Layer</span>?
          </h2>
          <p className="text-lg mb-8 max-w-3xl mx-auto">
            Get started with our comprehensive documentation and playground environment.
            Experience the power of secure, reliable blockchain services today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/docs/getting-started" className="btn btn-primary">
              Read the Docs
            </Link>
            <Link href="/playground" className="btn btn-outline border-white text-white hover:bg-white hover:text-secondary">
              Try the Playground
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}