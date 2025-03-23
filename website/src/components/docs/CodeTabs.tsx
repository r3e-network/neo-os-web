'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import CodeBlock from './CodeBlock';

interface TabData {
  label: string;
  language: string;
  code: string;
  filename?: string;
}

interface CodeTabsProps {
  tabs: TabData[];
  caption?: string;
}

export default function CodeTabs({ tabs, caption }: CodeTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="my-6 border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex border-b border-gray-200 bg-gray-50">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={`relative py-3 px-4 text-sm font-medium ${
              activeTab === index
                ? 'text-primary'
                : 'text-gray-500 hover:text-gray-700'
            } focus:outline-none transition-colors`}
          >
            {tab.label}
            {activeTab === index && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
      
      <div className="p-0 bg-gray-900">
        {tabs.map((tab, index) => (
          <div
            key={index}
            className={`${activeTab === index ? 'block' : 'hidden'}`}
          >
            <CodeBlock
              code={tab.code}
              language={tab.language}
              filename={tab.filename}
              showLineNumbers={true}
            />
          </div>
        ))}
      </div>
      
      {caption && (
        <div className="py-2 px-4 text-sm text-gray-500 border-t border-gray-200 bg-gray-50">
          {caption}
        </div>
      )}
    </div>
  );
}