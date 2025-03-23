"use client";

import { useState, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Tab {
  label: string;
  content: ReactNode;
}

interface TabPanelProps {
  tabs: Tab[];
  className?: string;
}

export default function TabPanel({ tabs, className = "" }: TabPanelProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className={`my-6 bg-white border rounded-lg overflow-hidden shadow-sm ${className}`}>
      <div className="flex border-b">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={`px-4 py-3 text-sm font-medium relative ${
              activeTab === index
                ? 'text-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {activeTab === index && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
      
      <div className="p-4">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {tabs[activeTab].content}
        </motion.div>
      </div>
    </div>
  );
}