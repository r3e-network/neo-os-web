"use client";

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Icon from '@/components/ui/Icon';

// Feature cards data
const features = [
  {
    title: 'Functions Service',
    description: 'Execute JavaScript functions securely in a Trusted Execution Environment (TEE).',
    icon: '/features/function.svg',
    href: '/features#functions',
  },
  {
    title: 'Secret Management',
    description: 'Store and use sensitive data with enterprise-grade security.',
    icon: '/features/secrets.svg',
    href: '/features#secrets',
  },
  {
    title: 'Contract Automation',
    description: 'Automate smart contract execution based on events and triggers.',
    icon: '/features/automation.svg',
    href: '/features#automation',
  },
  {
    title: 'Gas Bank',
    description: 'Efficient gas management for service operations.',
    icon: '/features/gasbank.svg',
    href: '/features#gas-bank',
  },
  {
    title: 'Random Number',
    description: 'Generate secure random numbers for your smart contracts.',
    icon: '/features/random.svg',
    href: '/features#random',
  },
  {
    title: 'Price Feed',
    description: 'Get reliable token price updates for your DeFi applications.',
    icon: '/features/pricefeed.svg',
    href: '/features#price-feed',
  },
];

// How it works steps
const steps = [
  {
    number: 1,
    title: 'Upload Your JavaScript Function',
    description: 'Create and upload your JavaScript functions through our API or web dashboard.',
  },
  {
    number: 2,
    title: 'Configure Secrets and Triggers',
    description: 'Set up your execution triggers and securely store API keys or credentials.',
  },
  {
    number: 3,
    title: 'Execution in TEE',
    description: 'Your function executes securely in a Trusted Execution Environment (TEE).',
  },
  {
    number: 4,
    title: 'Blockchain Interaction',
    description: 'Results are securely processed and can interact with the Neo N3 blockchain.',
  },
];

export default function Home() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        {/* Hero Background */}
        <div className="absolute inset-0 z-0">
          <Image 
            src="/hero-bg.svg" 
            alt="Background" 
            fill 
            priority
            className="object-cover"
          />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
            <motion.div 
              className="lg:w-1/2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white">
                <span className="text-primary">Trusted</span> Execution Environment for Neo N3 Blockchain
              </h1>
              <p className="text-lg md:text-xl mb-8 text-gray-200">
                A centralized oracle service providing secure function execution, contract automation, price feeds, and more for the Neo N3 ecosystem.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  href="/docs/getting-started" 
                  variant="primary" 
                  rounded 
                  className="shadow-glow"
                >
                  Get Started
                </Button>
                <Button 
                  href="/playground" 
                  variant="outline" 
                  rounded 
                  className="border-white text-white hover:bg-white hover:text-secondary"
                >
                  Try Playground
                </Button>
              </div>
            </motion.div>
            <motion.div 
              className="lg:w-1/2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="relative w-full h-[400px] bg-secondary/20 backdrop-blur-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-full p-6">
                    <div className="bg-secondary/80 rounded-xl p-6 h-full flex flex-col">
                      <div className="flex items-center mb-4 text-primary">
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                          <path d="M12 8V16M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        <span className="text-sm font-mono">function.js</span>
                      </div>
                      <div className="flex-grow font-mono text-sm text-gray-200 overflow-hidden">
                        <pre className="h-full overflow-auto p-2">
{`// Sample function to fetch token price
function getTokenPrice(symbol) {
  // In real TEE environment, this would
  // access trusted data sources
  if (!secrets.apiKey) {
    throw new Error("API key not found");
  }
    
  // Fetch price from multiple sources
  const prices = fetchPricesFromSources(symbol);
    
  // Apply outlier detection
  const validPrices = filterOutliers(prices);
    
  // Calculate average price
  return calculateWeightedAverage(validPrices);
}

// Execute with secrets accessible in TEE
return getTokenPrice(args.tokenSymbol);`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0 h-16">
          <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path d="M0 50L48 60C96 70 192 90 288 90C384 90 480 70 576 65C672 60 768 70 864 75C960 80 1056 80 1152 75C1248 70 1344 60 1392 55L1440 50V100H1392C1344 100 1248 100 1152 100C1056 100 960 100 864 100C768 100 672 100 576 100C480 100 384 100 288 100C192 100 96 100 48 100H0V50Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <motion.h2 
              className="text-3xl md:text-4xl font-bold mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Powerful <span className="text-primary">Services</span> for Neo N3 Developers
            </motion.h2>
            <motion.p 
              className="text-lg text-gray-600 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              The Service Layer provides a suite of tools that enhance the capabilities of smart contracts on the Neo N3 blockchain.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * index }}
              >
                <Card bordered hover className="h-full">
                  <Card.Body>
                    <Image 
                      src={feature.icon} 
                      alt={feature.title} 
                      width={64} 
                      height={64} 
                      className="mb-4"
                    />
                    <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                    <p className="text-gray-600 mb-4">{feature.description}</p>
                    <Link href={feature.href} className="text-primary font-semibold hover:underline flex items-center">
                      Learn more 
                      <Icon name="arrowRight" size="sm" className="ml-1" />
                    </Link>
                  </Card.Body>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <motion.h2 
              className="text-3xl md:text-4xl font-bold mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              How It <span className="text-primary">Works</span>
            </motion.h2>
            <motion.p 
              className="text-lg text-gray-600 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              The Service Layer uses Azure Confidential Computing to provide a secure and reliable execution environment for blockchain operations.
            </motion.p>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
            <div className="lg:w-1/2 order-2 lg:order-1">
              <div className="space-y-8">
                {steps.map((step, index) => (
                  <motion.div 
                    key={step.number}
                    className="flex gap-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 * index }}
                  >
                    <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-full flex items-center justify-center text-secondary font-bold text-xl">
                      {step.number}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                      <p className="text-gray-600">
                        {step.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <motion.div 
                className="mt-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <Button 
                  href="/docs/architecture" 
                  variant="secondary" 
                  rounded
                >
                  Read the Documentation
                </Button>
              </motion.div>
            </div>
            
            <motion.div 
              className="lg:w-1/2 order-1 lg:order-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="relative bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <Image 
                  src="/hero-bg.svg" 
                  alt="Architecture" 
                  width={600} 
                  height={400} 
                  className="w-full h-auto rounded-lg"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="glass-dark rounded-xl p-6 max-w-md text-center">
                    <h3 className="text-xl font-bold text-white mb-3">Secure Execution Environment</h3>
                    <p className="text-gray-200">
                      Our TEE ensures that your functions execute in a secure, isolated environment, 
                      protected from unauthorized access.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-secondary to-secondary/90 text-white">
        <div className="container mx-auto px-4 text-center">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Ready to <span className="text-primary">Get Started</span>?
          </motion.h2>
          <motion.p 
            className="text-lg mb-10 max-w-3xl mx-auto text-gray-200"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Join the Neo N3 Service Layer today and unlock the full potential of your blockchain applications.
          </motion.p>
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Button 
              href="/docs/getting-started" 
              variant="primary" 
              size="lg" 
              rounded 
              className="shadow-glow"
            >
              Get Started
            </Button>
            <Button 
              href="/contact" 
              variant="outline" 
              size="lg" 
              rounded 
              className="border-white text-white hover:bg-white hover:text-secondary"
            >
              Contact Us
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}