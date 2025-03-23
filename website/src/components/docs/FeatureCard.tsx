"use client";

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface FeatureCardProps {
  title: string;
  icon?: string;
  iconComponent?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function FeatureCard({ 
  title, 
  icon, 
  iconComponent, 
  children, 
  className = "" 
}: FeatureCardProps) {
  return (
    <motion.div 
      className={`border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all ${className}`}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="p-5">
        <div className="flex items-start mb-3">
          {icon && (
            <div className="mr-3 mt-1">
              <Image src={icon} alt={title} width={24} height={24} />
            </div>
          )}
          {iconComponent && (
            <div className="mr-3 mt-1">
              {iconComponent}
            </div>
          )}
          <h3 className="text-xl font-semibold">{title}</h3>
        </div>
        <div className="text-gray-600">
          {children}
        </div>
      </div>
    </motion.div>
  );
}