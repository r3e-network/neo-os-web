'use client';

import Link from 'next/link';
import Callout from '@/components/docs/Callout';

export default function RandomApiPage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Random Number API Reference</h1>
      
      <p className="lead">
        The Random Number API allows you to generate verifiable, secure random numbers for your applications.
      </p>
      
      <Callout type="info">
        This page is under construction. The full API documentation for the Random Number service will be available soon.
      </Callout>
      
      <p>
        In the meantime, you can learn more about the Random Number service:
      </p>
      
      <div className="flex flex-col md:flex-row gap-4 my-8">
        <Link 
          href="/docs/services/random" 
          className="flex-1 block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Random Number Service</h3>
          <p className="text-gray-600 mb-4">Learn about the Random Number generation service</p>
          <span className="text-primary">View Documentation →</span>
        </Link>
      </div>
    </div>
  );
}