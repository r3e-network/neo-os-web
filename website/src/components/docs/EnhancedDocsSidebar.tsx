'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// Define the sidebar structure with icons
const sidebarItems = [
  {
    title: 'Introduction',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="12" y1="16" x2="12" y2="16" />
      </svg>
    ),
    items: [
      { title: 'Overview', href: '/docs' },
      { title: 'Getting Started', href: '/docs/getting-started' },
      { title: 'Architecture', href: '/docs/architecture' },
    ],
  },
  {
    title: 'Services',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
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
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    items: [
      { title: 'Creating Functions', href: '/docs/guides/functions-guide' },
      { title: 'Managing Secrets', href: '/docs/guides/secrets-guide' },
      { title: 'Setting Up Automation', href: '/docs/guides/automation-guide' },
      { title: 'Using the API', href: '/docs/guides/api-guide' },
    ],
  },
  {
    title: 'API Reference',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34" />
        <polygon points="18 2 22 6 12 16 8 16 8 12 18 2" />
      </svg>
    ),
    items: [
      { title: 'Authentication', href: '/docs/api/authentication' },
      { title: 'Functions API', href: '/docs/api/functions-api' },
      { title: 'Secrets API', href: '/docs/api/secrets-api' },
      { title: 'Automation API', href: '/docs/api/automation-api' },
      { title: 'Gas Bank API', href: '/docs/api/gasbank-api' },
      { title: 'Random API', href: '/docs/api/random-api' },
      { title: 'Price Feed API', href: '/docs/api/price-feed-api' },
      { title: 'Oracle API', href: '/docs/api/oracle-api' },
    ],
  },
  {
    title: 'Wallet Integration',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M20 8H8" />
        <circle cx="16" cy="14" r="2" />
      </svg>
    ),
    items: [
      { title: 'Overview', href: '/docs/wallet-integration' },
      { title: 'Troubleshooting', href: '/docs/wallet-integration/troubleshooting' },
    ],
  },
  {
    title: 'Resources',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M21 10H3" />
        <path d="M21 6H3" />
        <path d="M21 14H3" />
        <path d="M21 18H3" />
      </svg>
    ),
    items: [
      { title: 'FAQ', href: '/docs/faq' },
      { title: 'Best Practices', href: '/docs/best-practices' },
      { title: 'SDK Reference', href: '/docs/sdk-reference' },
    ],
  },
];

export default function EnhancedDocsSidebar() {
  const pathname = usePathname();
  // Auto-expand the section that contains the current page
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  
  // Initialize open sections based on current path
  useEffect(() => {
    const initialOpenSections: Record<string, boolean> = {};
    
    sidebarItems.forEach(section => {
      const shouldBeOpen = section.items.some(item => 
        pathname === item.href || pathname?.startsWith(`${item.href}/`)
      );
      initialOpenSections[section.title] = shouldBeOpen;
    });
    
    setOpenSections(initialOpenSections);
  }, [pathname]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="w-full h-full">
      {/* Mobile menu button - only visible on small screens */}
      <div className="md:hidden p-4 flex justify-between items-center border-b">
        <Link href="/docs" className="text-xl font-bold text-secondary">
          Docs
        </Link>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen 
              ? "M6 18L18 6M6 6l12 12" 
              : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>
      
      {/* Sidebar content */}
      <div className={`transition-all duration-300 ease-in-out ${isMobileMenuOpen ? 'max-h-screen' : 'max-h-0 md:max-h-screen'} overflow-hidden md:overflow-auto`}>
        <div className="p-4">
          <Link href="/docs" className="hidden md:block text-xl font-bold text-secondary hover:text-primary transition-colors mb-6">
            Documentation
          </Link>
          
          {/* Search box */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search docs..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Navigation items */}
          <nav>
            <ul className="space-y-4">
              {sidebarItems.map((section) => {
                // Filter items based on search
                const filteredItems = searchQuery 
                  ? section.items.filter(item => 
                      item.title.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                  : section.items;
                
                // Only show sections with matching items when searching
                if (searchQuery && filteredItems.length === 0) {
                  return null;
                }
                
                return (
                  <li key={section.title} className="border-b border-gray-100 pb-4">
                    <button
                      onClick={() => toggleSection(section.title)}
                      className="flex items-center w-full text-left font-semibold text-gray-700 hover:text-primary transition-colors py-2 group"
                    >
                      <span className="mr-3 text-gray-500 group-hover:text-primary transition-colors">
                        {section.icon}
                      </span>
                      <span>{section.title}</span>
                      <svg
                        className={`ml-auto h-4 w-4 transition-transform ${openSections[section.title] ? 'transform rotate-180' : ''}`}
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
                    
                    <AnimatePresence>
                      {openSections[section.title] && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="ml-8 mt-2 space-y-1 overflow-hidden"
                        >
                          {filteredItems.map((item) => (
                            <motion.li 
                              key={item.href}
                              initial={{ x: -10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Link
                                href={item.href}
                                className={`group flex items-center py-1.5 text-sm relative ${
                                  isActive(item.href)
                                    ? 'text-primary font-medium'
                                    : 'text-gray-600 hover:text-primary'
                                } transition-colors`}
                              >
                                {isActive(item.href) && (
                                  <motion.span
                                    layoutId="activePage"
                                    className="absolute w-1 h-full bg-primary rounded-r-md left-[-1rem]"
                                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                  />
                                )}
                                {item.title}
                              </Link>
                            </motion.li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        
        {/* Version and links footer */}
        <div className="p-4 mt-auto border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs text-gray-500">
              Version 1.0.0
            </div>
            <Link href="https://github.com/R3E-Network/service_layer" className="text-xs text-primary hover:underline">
              GitHub
            </Link>
          </div>
          <Link href="/contact" className="block w-full py-2 px-3 text-center text-sm rounded-md bg-primary text-white hover:bg-primary-dark transition-colors">
            Get Support
          </Link>
        </div>
      </div>
    </div>
  );
}