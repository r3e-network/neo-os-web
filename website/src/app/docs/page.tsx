"use client";

import Link from 'next/link';

const serviceSections = [
  {
    title: 'Functions Service',
    description: 'Execute JavaScript functions in a secure Trusted Execution Environment (TEE).',
    href: '/docs/services/functions',
  },
  {
    title: 'Secret Management',
    description: 'Store sensitive data like API keys and credentials securely.',
    href: '/docs/services/secrets',
  },
  {
    title: 'Contract Automation',
    description: 'Automate smart contract interactions based on various triggers.',
    href: '/docs/services/automation',
  },
  {
    title: 'Gas Bank',
    description: 'Efficient gas management for service operations.',
    href: '/docs/services/gas-bank',
  },
  {
    title: 'Random Number Generation',
    description: 'Generate secure, verifiable random numbers for smart contracts.',
    href: '/docs/services/random',
  },
  {
    title: 'Price Feed',
    description: 'Get reliable token price updates for DeFi applications.',
    href: '/docs/services/price-feed',
  },
  {
    title: 'Oracle Service',
    description: 'Bring external data to the Neo N3 blockchain.',
    href: '/docs/services/oracle',
  },
];

const guideLinks = [
  { title: 'Getting Started', href: '/docs/getting-started' },
  { title: 'Architecture Overview', href: '/docs/architecture' },
  { title: 'Creating Functions', href: '/docs/guides/functions-guide' },
  { title: 'Managing Secrets', href: '/docs/guides/secrets-guide' },
  { title: 'Setting Up Automation', href: '/docs/guides/automation-guide' },
  { title: 'Using the API', href: '/docs/guides/api-guide' },
];

export default function DocsHomePage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Neo N3 Service Layer Documentation</h1>
      
      <p className="lead text-lg">
        Welcome to the Neo N3 Service Layer documentation. This documentation will help you understand 
        and use the various services provided by the Service Layer to enhance your Neo N3 applications.
      </p>

      <div className="my-12">
        <h2>Quick Start</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {guideLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
            >
              <h3 className="text-xl font-bold mb-2">{link.title}</h3>
              <div className="text-primary">Read guide →</div>
            </Link>
          ))}
        </div>
      </div>
      
      <div className="my-12">
        <h2>Services</h2>
        <p>
          The Neo N3 Service Layer provides a suite of services that enhance your blockchain applications. 
          Each service is designed to solve specific challenges in blockchain development.
        </p>
        
        <div className="mt-6 space-y-8">
          {serviceSections.map((service) => (
            <div key={service.href} className="border-l-4 border-primary pl-6 py-2">
              <h3 className="text-xl font-bold mb-1">{service.title}</h3>
              <p className="text-gray-600 mb-2">{service.description}</p>
              <Link href={service.href} className="text-primary font-medium hover:underline">
                Learn more →
              </Link>
            </div>
          ))}
        </div>
      </div>
      
      <div className="my-12">
        <h2>API Reference</h2>
        <p>
          Explore our API documentation to understand how to integrate with the Neo N3 Service Layer programmatically.
        </p>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link 
            href="/docs/api/authentication" 
            className="block p-4 border rounded-lg hover:border-primary hover:shadow-sm transition-all bg-white"
          >
            Authentication
          </Link>
          <Link 
            href="/docs/api/functions-api" 
            className="block p-4 border rounded-lg hover:border-primary hover:shadow-sm transition-all bg-white"
          >
            Functions API
          </Link>
          <Link 
            href="/docs/api/secrets-api" 
            className="block p-4 border rounded-lg hover:border-primary hover:shadow-sm transition-all bg-white"
          >
            Secrets API
          </Link>
          <Link 
            href="/docs/api/automation-api" 
            className="block p-4 border rounded-lg hover:border-primary hover:shadow-sm transition-all bg-white"
          >
            Automation API
          </Link>
        </div>
        <div className="mt-4">
          <Link href="/docs/api" className="text-primary font-medium hover:underline">
            View all API documentation →
          </Link>
        </div>
      </div>
      
      <div className="my-12">
        <h2>Resources</h2>
        <p>
          Find additional resources to help you get the most out of the Neo N3 Service Layer.
        </p>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link 
            href="/docs/examples" 
            className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white text-center"
          >
            <div className="text-3xl mb-2">📚</div>
            <h3 className="text-lg font-bold">Examples</h3>
            <p className="text-sm text-gray-600">
              Code examples and tutorials
            </p>
          </Link>
          
          <Link 
            href="/docs/faq" 
            className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white text-center"
          >
            <div className="text-3xl mb-2">❓</div>
            <h3 className="text-lg font-bold">FAQ</h3>
            <p className="text-sm text-gray-600">
              Frequently asked questions
            </p>
          </Link>
          
          <Link 
            href="/docs/troubleshooting" 
            className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white text-center"
          >
            <div className="text-3xl mb-2">🔧</div>
            <h3 className="text-lg font-bold">Troubleshooting</h3>
            <p className="text-sm text-gray-600">
              Common issues and solutions
            </p>
          </Link>
        </div>
      </div>
      
      <div className="my-12 p-6 bg-secondary text-white rounded-lg">
        <h2 className="text-white">Need Help?</h2>
        <p>
          If you can't find what you're looking for in the documentation, there are several ways to get help:
        </p>
        <ul>
          <li>Join our <a href="https://discord.gg/r3e-network" className="text-primary hover:underline">Discord community</a></li>
          <li>Open an issue on <a href="https://github.com/R3E-Network/service_layer" className="text-primary hover:underline">GitHub</a></li>
          <li>Contact us through the <Link href="/contact" className="text-primary hover:underline">Contact page</Link></li>
        </ul>
      </div>
    </div>
  );
}