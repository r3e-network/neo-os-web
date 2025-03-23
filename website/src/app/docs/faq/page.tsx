'use client';

import Link from 'next/link';

export default function FAQPage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Frequently Asked Questions</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <p className="mb-0">
          Find answers to common questions about Neo Service Layer. If you don't see your question answered here,
          please <a href="mailto:support@neoservicelayer.com" className="text-blue-700 hover:underline">contact our support team</a>.
        </p>
      </div>
      
      <div className="space-y-10">
        {/* General Questions */}
        <section>
          <h2 className="text-2xl font-bold" id="general">General Questions</h2>
          
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mt-0">What is Neo Service Layer?</h3>
              <p>
                Neo Service Layer is a service platform that provides essential infrastructure for developers 
                building on the Neo N3 blockchain. Our platform offers a suite of services including GasBank, 
                Functions, Contract Automation, Random Number Generation, Price Feeds, and Oracle services, 
                all secured through Trusted Execution Environment (TEE) technology.
              </p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mt-0">How is Neo Service Layer secured?</h3>
              <p>
                We use Trusted Execution Environment (TEE) technology to ensure 
                security and data integrity while offering infrastructure that's optimized for Neo N3 developers.
              </p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mt-0">What blockchain networks do you support?</h3>
              <p>
                Neo Service Layer is built specifically for the Neo N3 blockchain. We currently don't support other 
                blockchain networks.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}