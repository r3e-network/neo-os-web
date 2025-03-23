'use client';

import Link from 'next/link';
import CodeBlock from '@/components/docs/CodeBlock';
import Callout from '@/components/docs/Callout';

export default function AutomationGuidePage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Setting Up Automation Guide</h1>
      
      <p className="lead">
        Learn how to automate smart contract interactions and functions using the Neo Service Layer Automation service.
      </p>
      
      <Callout type="info">
        This is a basic version of the automation guide. It will be expanded with more detailed content in future updates.
      </Callout>
      
      <h2 id="what-is-automation">What is Contract Automation?</h2>
      
      <p>
        The Contract Automation service allows you to set up triggers that automatically execute functions or 
        interact with smart contracts based on various conditions:
      </p>
      
      <ul>
        <li>Time-based schedules (using cron expressions)</li>
        <li>Blockchain events (like contract operations or token transfers)</li>
        <li>Price thresholds (when a token reaches a certain price)</li>
        <li>External API events</li>
      </ul>
      
      <h2 id="automation-examples">Automation Examples</h2>
      
      <h3>Time-Based Automation</h3>
      
      <CodeBlock 
        language="javascript"
        code={`// Configuration for daily execution at midnight
{
  "name": "dailyUpdate",
  "trigger": {
    "type": "schedule",
    "cron": "0 0 * * *"
  },
  "action": {
    "type": "function",
    "functionId": "your-function-id",
    "parameters": {
      "operation": "daily-update"
    }
  }
}`}
        filename="daily-automation.json"
      />
      
      <h3>Blockchain Event Automation</h3>
      
      <CodeBlock 
        language="javascript"
        code={`// Configuration for responding to contract events
{
  "name": "transferMonitor",
  "trigger": {
    "type": "blockchain",
    "scriptHash": "0x1234567890abcdef1234567890abcdef12345678",
    "event": "Transfer"
  },
  "action": {
    "type": "function",
    "functionId": "transfer-processor",
    "parameters": {
      "notify": true
    }
  }
}`}
        filename="event-automation.json"
      />
      
      <h2 id="further-learning">Further Learning</h2>
      
      <div className="flex flex-col md:flex-row gap-4 my-8">
        <Link 
          href="/docs/services/automation" 
          className="flex-1 block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Automation Service</h3>
          <p className="text-gray-600 mb-4">Learn more about the Automation service</p>
          <span className="text-primary">View Documentation →</span>
        </Link>
        
        <Link 
          href="/docs/api/automation-api" 
          className="flex-1 block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Automation API</h3>
          <p className="text-gray-600 mb-4">Explore the Automation API reference</p>
          <span className="text-primary">View API →</span>
        </Link>
      </div>
    </div>
  );
}