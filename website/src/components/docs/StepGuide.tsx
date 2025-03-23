"use client";

import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Step {
  title: string;
  content: ReactNode;
}

interface StepGuideProps {
  steps: Step[];
  className?: string;
}

export default function StepGuide({ steps, className = "" }: StepGuideProps) {
  return (
    <div className={`my-8 ${className}`}>
      <div className="space-y-6">
        {steps.map((step, index) => (
          <motion.div 
            key={index}
            className="relative"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            viewport={{ once: true, margin: "-50px" }}
          >
            {/* Step number indicator with line */}
            <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-bold">
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className="w-0.5 bg-gray-200 flex-grow mt-2"></div>
              )}
            </div>
            
            {/* Step content */}
            <div className="ml-12 pb-6">
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <div className="text-gray-600">{step.content}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}