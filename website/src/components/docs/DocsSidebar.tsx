"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Define the sidebar structure
const sidebarItems = [
  {
    title: 'Introduction',
    items: [
      { title: 'Overview', href: '/docs' },
      { title: 'Getting Started', href: '/docs/getting-started' },
      { title: 'Architecture', href: '/docs/architecture' },
    ],
  },
  {
    title: 'Core Concepts',
    items: [
      { title: 'Trusted Execution Environment', href: '/docs/core-concepts/tee' },
      { title: 'Neo N3 Integration', href: '/docs/core-concepts/neo-n3-integration' },
      { title: 'Security Model', href: '/docs/core-concepts/security-model' },
    ],
  },
  {
    title: 'Services',
    items: [
      { title: 'Functions', href: '/docs/services/functions' },
      { title: 'Secrets', href: '/docs/services/secrets' },
      { title: 'Contract Automation', href: '/docs/services/automation' },
      { title: 'Gas Bank', href: '/docs/services/gas-bank' },
      { title: 'Random Number', href: '/docs/services/random' },
      { title: 'Price Feed', href: '/docs/services/price-feed' },
      { title: 'Oracle', href: '/docs/services/oracle' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { title: 'Creating Functions', href: '/docs/guides/functions-guide' },
      { title: 'Managing Secrets', href: '/docs/guides/secrets-guide' },
      { title: 'Setting Up Automation', href: '/docs/guides/automation-guide' },
      { title: 'Using the API', href: '/docs/guides/api-guide' },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { title: 'Authentication', href: '/docs/api/authentication' },
      { title: 'Functions API', href: '/docs/api/functions-api' },
      { title: 'Secrets API', href: '/docs/api/secrets-api' },
      { title: 'Automation API', href: '/docs/api/automation-api' },
      { title: 'Gas Bank API', href: '/docs/api/gas-bank-api' },
      { title: 'Random API', href: '/docs/api/random-api' },
      { title: 'Price Feed API', href: '/docs/api/price-feed-api' },
      { title: 'Oracle API', href: '/docs/api/oracle-api' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { title: 'Examples', href: '/docs/examples' },
      { title: 'FAQ', href: '/docs/faq' },
      { title: 'Troubleshooting', href: '/docs/troubleshooting' },
      { title: 'SDK Reference', href: '/docs/sdk-reference' },
    ],
  },
];

export default function DocsSidebar() {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    // Initialize all sections as open
    Object.fromEntries(sidebarItems.map(section => [section.title, true]))
  );

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <div className="w-full md:w-64 bg-white p-4 border-r border-gray-200 h-full overflow-y-auto">
      <div className="mb-8">
        <Link href="/docs" className="text-xl font-bold text-secondary hover:text-primary transition-colors">
          Documentation
        </Link>
      </div>
      
      <nav>
        <ul className="space-y-6">
          {sidebarItems.map((section) => (
            <li key={section.title}>
              <button
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full text-left text-sm font-semibold text-gray-700 hover:text-primary transition-colors mb-2"
              >
                {section.title}
                <svg
                  className={`h-4 w-4 transition-transform ${openSections[section.title] ? 'transform rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              
              {openSections[section.title] && (
                <ul className="ml-2 space-y-1 border-l border-gray-200 pl-4">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block py-1 text-sm ${
                          isActive(item.href)
                            ? 'text-primary font-medium'
                            : 'text-gray-600 hover:text-primary'
                        } transition-colors`}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}