'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import EnhancedDocsSidebar from '@/components/docs/EnhancedDocsSidebar';
import { motion } from 'framer-motion';

export default function EnhancedDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isTOCOpen, setIsTOCOpen] = useState(true);
  const [headings, setHeadings] = useState<{id: string; text: string; level: number}[]>([]);
  const [activeHeading, setActiveHeading] = useState('');
  
  // Extract headings from the page and set up intersection observer for scroll spy
  useEffect(() => {
    // Reset headings when pathname changes
    setHeadings([]);
    setActiveHeading('');
    
    // Wait for the DOM to be ready
    setTimeout(() => {
      const contentElement = document.querySelector('.docs-content');
      if (!contentElement) return;
      
      // Extract headings
      const headingElements = contentElement.querySelectorAll('h1, h2, h3');
      const extractedHeadings = Array.from(headingElements).map(el => ({
        id: el.id || '',
        text: el.textContent || '',
        level: parseInt(el.tagName.charAt(1)),
      })).filter(heading => heading.id);
      
      setHeadings(extractedHeadings);
      
      // Set up intersection observer for scroll spy
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              setActiveHeading(entry.target.id);
            }
          });
        },
        {
          rootMargin: '0px 0px -80% 0px',
          threshold: 0,
        }
      );
      
      headingElements.forEach(el => {
        if (el.id) {
          observer.observe(el);
        }
      });
      
      return () => {
        headingElements.forEach(el => {
          if (el.id) {
            observer.unobserve(el);
          }
        });
      };
    }, 500);
  }, [pathname]);
  
  // Add IDs to headings in content if they don't exist
  useEffect(() => {
    const contentElement = document.querySelector('.docs-content');
    if (!contentElement) return;
    
    const headingElements = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headingElements.forEach(el => {
      if (!el.id && el.textContent) {
        // Create an ID from the heading text
        el.id = el.textContent
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }
    });
  }, [pathname]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top progress bar - fixed at the top */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50">
        <motion.div
          className="h-full bg-primary"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          exit={{ scaleX: 0 }}
          transition={{ duration: 0.3 }}
          style={{ transformOrigin: "0% 50%" }}
        />
      </div>
      
      <div className="flex flex-1 pt-1">
        {/* Sidebar - fixed on desktop, sliding on mobile */}
        <div className="md:w-64 md:fixed md:h-[calc(100vh-1px)] md:top-1 shrink-0 overflow-y-auto bg-white border-r border-gray-200 shadow-sm z-10">
          <EnhancedDocsSidebar />
        </div>
        
        {/* Main content area */}
        <div className="flex-1 md:ml-64">
          <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 flex">
            {/* Content area */}
            <div className="flex-1 docs-content">
              <div className="bg-white shadow-sm rounded-lg p-8 mb-8">
                {children}
              </div>
              
              {/* Feedback and navigation section */}
              <div className="mt-12 border-t border-gray-200 pt-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                  {/* Feedback */}
                  <div className="mb-6 md:mb-0">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Was this page helpful?</h4>
                    <div className="flex space-x-2">
                      <button className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                        <span role="img" aria-label="thumbs up">👍</span> Yes
                      </button>
                      <button className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                        <span role="img" aria-label="thumbs down">👎</span> No
                      </button>
                    </div>
                  </div>
                  
                  {/* Edit on GitHub */}
                  <a 
                    href="https://github.com/R3E-Network/service_layer" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:text-primary-dark transition-colors flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    Edit this page on GitHub
                  </a>
                </div>
              </div>
            </div>
            
            {/* Table of Contents - only visible on larger screens */}
            <div className="hidden xl:block w-64 ml-8 relative">
              <div className="sticky top-12">
                {headings.length > 0 && (
                  <div className="bg-white shadow-sm rounded-lg p-5">
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">
                      On This Page
                    </h4>
                    <nav>
                      <ul className="space-y-2">
                        {headings.map(heading => (
                          <li key={heading.id} style={{ paddingLeft: `${(heading.level - 1) * 0.75}rem` }}>
                            <a
                              href={`#${heading.id}`}
                              className={`block text-sm py-1 border-l-2 pl-3 ${
                                activeHeading === heading.id
                                  ? 'border-primary text-primary font-medium'
                                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                              } transition-all`}
                            >
                              {heading.text}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </nav>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}