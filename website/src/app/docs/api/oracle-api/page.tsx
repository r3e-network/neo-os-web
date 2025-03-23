'use client';

import Link from 'next/link';
import Callout from '@/components/docs/Callout';

export default function OracleApiPage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Oracle API Reference</h1>
      
      <p className="lead">
        The Oracle API allows you to connect smart contracts with external data sources in a secure and reliable way.
      </p>
      
      <Callout type="info">
        This page is under construction. The full API documentation for the Oracle service will be available soon.
      </Callout>
      
      <p>
        In the meantime, you can learn more about the Oracle service:
      </p>
      
      <div className="flex flex-col md:flex-row gap-4 my-8">
        <Link 
          href="/docs/services/oracle" 
          className="flex-1 block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Oracle Service</h3>
          <p className="text-gray-600 mb-4">Learn about the Oracle service</p>
          <span className="text-primary">View Documentation →</span>
        </Link>
      </div>
    </div>
  );
}