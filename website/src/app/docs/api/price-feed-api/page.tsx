'use client';

import Link from 'next/link';
import Callout from '@/components/docs/Callout';

export default function PriceFeedApiPage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Price Feed API Reference</h1>
      
      <p className="lead">
        The Price Feed API allows you to access reliable, real-time cryptocurrency price data.
      </p>
      
      <Callout type="info">
        This page is under construction. The full API documentation for the Price Feed service will be available soon.
      </Callout>
      
      <p>
        In the meantime, you can learn more about the Price Feed service:
      </p>
      
      <div className="flex flex-col md:flex-row gap-4 my-8">
        <Link 
          href="/docs/services/price-feed" 
          className="flex-1 block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Price Feed Service</h3>
          <p className="text-gray-600 mb-4">Learn about the Price Feed service</p>
          <span className="text-primary">View Documentation →</span>
        </Link>
      </div>
    </div>
  );
}