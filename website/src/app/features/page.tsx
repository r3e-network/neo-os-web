"use client";

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

// Feature data
const features = [
  {
    id: 'functions',
    title: 'Functions Service',
    description: 'Execute JavaScript functions in a secure Trusted Execution Environment (TEE). The Functions Service enables developers to run custom logic that can read blockchain state, fetch external data, and make authenticated API calls, all within a secure environment.',
    icon: '📦',
    details: [
      'Secure JavaScript execution in Azure Confidential Computing TEE',
      'Memory limits and timeout enforcement',
      'Function isolation with VM-per-execution model',
      'Sandbox security with frozen prototypes and strict mode',
      'Access to blockchain data and external APIs',
      'Support for secrets and environment variables',
    ],
  },
  {
    id: 'secrets',
    title: 'Secret Management',
    description: 'Store sensitive data like API keys, private keys, and other credentials securely. The Secret Management service uses envelope encryption to protect your secrets, which are only accessible within the TEE during function execution.',
    icon: '🔐',
    details: [
      'Envelope encryption for all secrets',
      'Data key rotation mechanism',
      'Comprehensive audit logging',
      'User isolation for secrets',
      'TEE-based access control',
      'Integration with Functions service',
    ],
  },
  {
    id: 'automation',
    title: 'Contract Automation',
    description: 'Automate smart contract interactions based on various triggers. Set up time-based schedules, blockchain events, or price thresholds to automatically execute functions or interact with contracts.',
    icon: '⚙️',
    details: [
      'Time-based scheduling (cron expressions)',
      'Blockchain event triggers',
      'Price threshold triggers',
      'Conditional execution logic',
      'Failure handling and retry mechanisms',
      'Execution history and monitoring',
    ],
  },
  {
    id: 'gas-bank',
    title: 'Gas Bank',
    description: 'Efficient gas management for service operations. The Gas Bank handles the complexities of transaction fees, ensuring your contracts and automated functions always have the gas they need to execute.',
    icon: '⛽',
    details: [
      'Automatic gas fee calculation',
      'Gas usage optimization',
      'Fee estimation based on network conditions',
      'Prepaid gas accounts',
      'Automatic refill options',
      'Usage reporting and analytics',
    ],
  },
  {
    id: 'random',
    title: 'Random Number Generation',
    description: 'Generate secure, verifiable random numbers for your smart contracts. The Random service uses TEE to ensure the randomness cannot be tampered with, making it ideal for games, lotteries, and fair selection processes.',
    icon: '🎲',
    details: [
      'Cryptographically secure random generation',
      'TEE-based execution for tamper resistance',
      'On-chain verification',
      'Support for various distributions',
      'Customizable range and precision',
      'Low latency and high reliability',
    ],
  },
  {
    id: 'price-feed',
    title: 'Price Feed',
    description: 'Get reliable token price updates for your DeFi applications. The Price Feed service aggregates data from multiple sources, validates it in the TEE, and publishes it to the blockchain at regular intervals.',
    icon: '💹',
    details: [
      'Multi-source data aggregation',
      'Outlier detection and filtering',
      'Configurable update frequency',
      'Support for multiple asset pairs',
      'Historical data access',
      'Low deviation thresholds',
    ],
  },
  {
    id: 'oracle',
    title: 'Oracle Service',
    description: 'Bring external data to the Neo N3 blockchain. The Oracle service allows smart contracts to access real-world data from various sources, all validated and processed within the TEE for maximum security.',
    icon: '🔮',
    details: [
      'External API integration',
      'Data transformation capabilities',
      'XML, JSON, and CSV parsing',
      'Custom data source configuration',
      'Response validation and verification',
      'Caching and rate limiting',
    ],
  },
];

export default function FeaturesPage() {
  // Create refs for scrolling to sections
  const sectionRefs = features.reduce((acc, feature) => {
    acc[feature.id] = useRef(null);
    return acc;
  }, {} as { [key: string]: React.RefObject<HTMLDivElement> });

  // Function to scroll to a section
  const scrollToSection = (id: string) => {
    sectionRefs[id]?.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="bg-gray-50">
      {/* Hero Section */}
      <section className="pt-20 pb-16 bg-gradient-to-r from-secondary to-secondary/90 text-white">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-primary">Features</span> & Services
            </h1>
            <p className="text-lg md:text-xl mb-8 text-gray-200 max-w-3xl mx-auto">
              The Neo N3 Service Layer provides a comprehensive suite of services to enhance your blockchain applications with secure, reliable infrastructure.
            </p>
          </motion.div>

          {/* Feature Navigation */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {features.map((feature) => (
              <button
                key={feature.id}
                onClick={() => scrollToSection(feature.id)}
                className="px-4 py-2 bg-secondary/50 hover:bg-primary hover:text-secondary rounded-full text-sm font-medium transition-colors duration-200"
              >
                {feature.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Features Sections */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="space-y-32">
            {features.map((feature, index) => (
              <div 
                key={feature.id}
                ref={sectionRefs[feature.id]}
                id={feature.id}
                className="scroll-mt-20"
              >
                <div className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-16`}>
                  <div className="lg:w-1/2">
                    <motion.div
                      initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                    >
                      <div className="text-5xl mb-4">{feature.icon}</div>
                      <h2 className="text-3xl font-bold mb-4">{feature.title}</h2>
                      <p className="text-lg text-gray-600 mb-6">{feature.description}</p>
                      
                      <ul className="space-y-3">
                        {feature.details.map((detail, i) => (
                          <li key={i} className="flex items-start">
                            <span className="text-primary mr-2">✓</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-8">
                        <Link href={`/docs/services/${feature.id}`} className="btn btn-primary">
                          View Documentation
                        </Link>
                      </div>
                    </motion.div>
                  </div>
                  
                  <div className="lg:w-1/2">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                      className="relative w-full h-[400px] rounded-lg overflow-hidden shadow-xl"
                    >
                      {/* Replace with actual feature illustration */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-gray-600">
                        <div className="text-center">
                          <div className="text-7xl mb-4">{feature.icon}</div>
                          <div className="text-xl">{feature.title}</div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-secondary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to try these <span className="text-primary">features</span>?
          </h2>
          <p className="text-lg mb-8 max-w-3xl mx-auto">
            Experience the power of the Neo N3 Service Layer through our interactive playground or dive into the documentation to learn more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/playground" className="btn btn-primary">
              Try the Playground
            </Link>
            <Link href="/docs" className="btn btn-outline border-white text-white hover:bg-white hover:text-secondary">
              Read the Docs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}