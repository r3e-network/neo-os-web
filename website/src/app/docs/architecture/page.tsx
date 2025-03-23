"use client";

import Link from 'next/link';
import Image from 'next/image';

export default function ArchitectureDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Neo Service Layer Architecture</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          The Neo Service Layer provides a secure, scalable infrastructure for extending Neo N3 blockchain 
          capabilities. This document explains the high-level architecture, security model, and core 
          components of the service.
        </p>
      </div>
      
      <h2>System Architecture</h2>
      
      <div className="my-8">
        <p>
          The Neo Service Layer uses a multi-layered architecture to provide secure, scalable 
          off-chain services for Neo N3 applications:
        </p>
        
        <Image 
          src="/images/docs/architecture-overview.png" 
          alt="Neo Service Layer Architecture Overview" 
          width={900} 
          height={500}
          className="my-8 border rounded-lg shadow-md"
          style={{maxWidth: '100%', height: 'auto'}}
        />
        
        <h3>Key Components</h3>
        
        <ol className="list-decimal pl-6 space-y-4">
          <li>
            <p>
              <strong>API Gateway Layer</strong> - Handles authentication, rate limiting, and request routing.
              This is the entry point for all external requests.
            </p>
          </li>
          <li>
            <p>
              <strong>Service Orchestration Layer</strong> - Manages service discovery, load balancing,
              and request processing across the platform services.
            </p>
          </li>
          <li>
            <p>
              <strong>TEE (Trusted Execution Environment) Services</strong> - Core services running in 
              Azure Confidential Computing environments that provide secure execution isolated from the host system.
            </p>
          </li>
          <li>
            <p>
              <strong>Blockchain Integration Layer</strong> - Handles communication with the Neo N3 blockchain,
              including transaction creation, signing, and monitoring.
            </p>
          </li>
          <li>
            <p>
              <strong>Data Management Layer</strong> - Manages persistent data storage, caching, and retrieval
              for the service.
            </p>
          </li>
        </ol>
      </div>
      
      <h2>Trusted Execution Environment (TEE)</h2>
      
      <div className="my-8">
        <p>
          At the core of the Neo Service Layer security model is the use of Trusted Execution Environments (TEEs).
          We use Azure Confidential Computing to create secure, isolated environments for processing sensitive data
          and executing code.
        </p>
        
        <h3>How TEE Works</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
          <div className="border p-5 rounded-lg">
            <h4 className="text-lg font-semibold mb-2">Memory Encryption</h4>
            <p>
              TEE uses hardware-level encryption to protect data in memory, ensuring that even the system
              administrators cannot access the data being processed.
            </p>
          </div>
          
          <div className="border p-5 rounded-lg">
            <h4 className="text-lg font-semibold mb-2">Code Integrity</h4>
            <p>
              TEE validates the integrity of code before execution, ensuring that only authorized code runs
              in the secure environment.
            </p>
          </div>
          
          <div className="border p-5 rounded-lg">
            <h4 className="text-lg font-semibold mb-2">Remote Attestation</h4>
            <p>
              TEE provides cryptographic proof that code is running in a genuine TEE with the expected
              configuration, allowing users to verify the environment.
            </p>
          </div>
          
          <div className="border p-5 rounded-lg">
            <h4 className="text-lg font-semibold mb-2">Secure Key Management</h4>
            <p>
              Cryptographic keys are generated and stored within the TEE, never exposed to the host
              system or administrators.
            </p>
          </div>
        </div>
        
        <h3>TEE Implementation</h3>
        
        <p>
          The Neo Service Layer uses Azure Confidential Computing with Intel SGX (Software Guard Extensions)
          to create TEEs. This provides hardware-based memory encryption that isolates code and data in memory
          from the operating system, hypervisor, and other applications.
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// Simplified representation of TEE initialization for Function execution

// Step 1: Create the TEE enclave
const enclave = await TEE.createEnclave({
  type: 'SGX',
  codeIdentity: 'function-executor-v1.2.3',
  securityLevel: 'EAL5'
});

// Step 2: Load user code and secrets into the enclave
await enclave.loadCode(functionCode);
await enclave.loadSecrets(functionSecrets);

// Step 3: Generate attestation report
const attestation = await enclave.generateAttestation();

// Step 4: Execute code in the secure enclave
const result = await enclave.execute(functionInput);

// Step 5: Return result and attestation proof
return {
  result,
  attestation
};`}</pre>
      </div>
      
      <h2>Technology Stack</h2>
      
      <div className="my-8">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Component</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Technologies</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2">API Gateway</td>
                <td className="border border-gray-300 px-4 py-2">Kong, NGINX, Azure API Management</td>
                <td className="border border-gray-300 px-4 py-2">Request routing, authentication, rate limiting</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">Service Core</td>
                <td className="border border-gray-300 px-4 py-2">Go, gRPC, Protocol Buffers</td>
                <td className="border border-gray-300 px-4 py-2">Core service implementation, inter-service communication</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">TEE Runtime</td>
                <td className="border border-gray-300 px-4 py-2">Intel SGX, Azure Confidential Computing, Open Enclave SDK</td>
                <td className="border border-gray-300 px-4 py-2">Secure execution environment</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">Function Runtime</td>
                <td className="border border-gray-300 px-4 py-2">Node.js (v16, v18)</td>
                <td className="border border-gray-300 px-4 py-2">JavaScript function execution</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Blockchain Integration</td>
                <td className="border border-gray-300 px-4 py-2">NeoGo SDK, Neo.js, Custom RPC clients</td>
                <td className="border border-gray-300 px-4 py-2">Neo N3 blockchain interaction</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">Data Storage</td>
                <td className="border border-gray-300 px-4 py-2">PostgreSQL, Redis, Azure Cosmos DB</td>
                <td className="border border-gray-300 px-4 py-2">Persistent storage, caching</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Monitoring & Logging</td>
                <td className="border border-gray-300 px-4 py-2">Prometheus, Grafana, ELK Stack</td>
                <td className="border border-gray-300 px-4 py-2">System monitoring, log aggregation, alerting</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">Infrastructure</td>
                <td className="border border-gray-300 px-4 py-2">Kubernetes, Docker, Azure Cloud</td>
                <td className="border border-gray-300 px-4 py-2">Container orchestration, infrastructure management</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <h2>Service Components</h2>
      
      <div className="my-8">
        <p>
          The Neo Service Layer is composed of several core services, each providing specific functionality:
        </p>
        
        <div className="space-y-6 my-6">
          <div className="border p-5 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Functions Service</h3>
            <p className="mb-4">
              The Functions Service allows developers to deploy and execute JavaScript code in a secure TEE.
            </p>
            <div className="pl-4 border-l-4 border-gray-200">
              <h4 className="font-medium">Key Components:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Function Executor - Runs JavaScript code in isolated environments</li>
                <li>Function Store - Manages deployed function code and metadata</li>
                <li>Invocation Manager - Handles function invocation requests and responses</li>
                <li>Context Provider - Supplies execution context to functions</li>
              </ul>
            </div>
          </div>
          
          <div className="border p-5 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Secrets Management</h3>
            <p className="mb-4">
              The Secrets Management service provides secure storage and access to sensitive credentials and data.
            </p>
            <div className="pl-4 border-l-4 border-gray-200">
              <h4 className="font-medium">Key Components:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Secret Store - Encrypted storage for sensitive data</li>
                <li>Access Control - Manages permissions for secret access</li>
                <li>Secret Provider - Delivers secrets to authorized functions</li>
                <li>Audit Logger - Records all secret access and modifications</li>
              </ul>
            </div>
          </div>
          
          <div className="border p-5 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Contract Automation</h3>
            <p className="mb-4">
              The Contract Automation service enables time and event-based triggers for smart contract interactions.
            </p>
            <div className="pl-4 border-l-4 border-gray-200">
              <h4 className="font-medium">Key Components:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Trigger Manager - Processes and evaluates trigger conditions</li>
                <li>Schedule Manager - Handles time-based scheduling</li>
                <li>Event Listener - Monitors blockchain and external events</li>
                <li>Action Executor - Performs the configured actions when triggered</li>
              </ul>
            </div>
          </div>
          
          <div className="border p-5 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Gas Bank</h3>
            <p className="mb-4">
              The Gas Bank service manages GAS deposits and consumption for service operations.
            </p>
            <div className="pl-4 border-l-4 border-gray-200">
              <h4 className="font-medium">Key Components:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Account Manager - Tracks user GAS balances</li>
                <li>Transaction Processor - Handles deposits and withdrawals</li>
                <li>Fee Calculator - Estimates and charges GAS fees for operations</li>
                <li>Billing Reporter - Generates usage reports</li>
              </ul>
            </div>
          </div>
          
          <div className="border p-5 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Price Feed</h3>
            <p className="mb-4">
              The Price Feed service provides reliable market price data for cryptocurrencies and tokens.
            </p>
            <div className="pl-4 border-l-4 border-gray-200">
              <h4 className="font-medium">Key Components:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Data Aggregator - Collects price data from multiple sources</li>
                <li>Price Validator - Validates and normalizes price data</li>
                <li>Update Scheduler - Manages the frequency of price updates</li>
                <li>On-chain Publisher - Publishes price data to smart contracts</li>
              </ul>
            </div>
          </div>
          
          <div className="border p-5 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Random Number Generation</h3>
            <p className="mb-4">
              The Random service provides secure, verifiable random numbers for applications.
            </p>
            <div className="pl-4 border-l-4 border-gray-200">
              <h4 className="font-medium">Key Components:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Entropy Collector - Gathers entropy from multiple sources</li>
                <li>Random Generator - Produces random values with cryptographic security</li>
                <li>Verification Provider - Creates proofs of randomness</li>
                <li>Distribution Manager - Delivers random values to applications</li>
              </ul>
            </div>
          </div>
          
          <div className="border p-5 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Oracle Service</h3>
            <p className="mb-4">
              The Oracle service connects smart contracts with external data sources.
            </p>
            <div className="pl-4 border-l-4 border-gray-200">
              <h4 className="font-medium">Key Components:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>Data Fetcher - Retrieves data from external sources</li>
                <li>Data Transformer - Processes and formats data</li>
                <li>Consensus Engine - Validates data using configurable consensus methods</li>
                <li>Delivery Manager - Provides data to smart contracts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <h2>Security Model</h2>
      
      <div className="my-8">
        <p>
          The Neo Service Layer employs a comprehensive security model with multiple layers of protection:
        </p>
        
        <div className="my-6 space-y-6">
          <div className="border-l-4 border-primary pl-6 py-2">
            <h3 className="text-xl font-semibold mb-2">1. TEE Protection</h3>
            <p>
              All sensitive operations occur within Trusted Execution Environments, providing hardware-level
              isolation from the host system.
            </p>
          </div>
          
          <div className="border-l-4 border-primary pl-6 py-2">
            <h3 className="text-xl font-semibold mb-2">2. Authentication & Authorization</h3>
            <p>
              Strong API key authentication and role-based access control restrict access to resources and operations.
            </p>
          </div>
          
          <div className="border-l-4 border-primary pl-6 py-2">
            <h3 className="text-xl font-semibold mb-2">3. Encryption</h3>
            <p>
              End-to-end encryption for all sensitive data, both in transit and at rest, using industry-standard
              algorithms and key management.
            </p>
          </div>
          
          <div className="border-l-4 border-primary pl-6 py-2">
            <h3 className="text-xl font-semibold mb-2">4. Secure Development</h3>
            <p>
              Rigorous secure development practices, including code reviews, static analysis, and 
              penetration testing.
            </p>
          </div>
          
          <div className="border-l-4 border-primary pl-6 py-2">
            <h3 className="text-xl font-semibold mb-2">5. Operational Security</h3>
            <p>
              Comprehensive monitoring, logging, and alerting to detect and respond to security events.
            </p>
          </div>
          
          <div className="border-l-4 border-primary pl-6 py-2">
            <h3 className="text-xl font-semibold mb-2">6. Compliance & Auditing</h3>
            <p>
              Regular security audits and compliance with industry standards and best practices.
            </p>
          </div>
        </div>
      </div>
      
      <h2>High Availability and Scalability</h2>
      
      <div className="my-8">
        <p>
          The Neo Service Layer is designed for high availability and scalability to ensure reliable service
          for blockchain applications:
        </p>
        
        <h3>Availability Features</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li>Multi-zone deployment across Azure regions</li>
          <li>Automatic failover and replication for critical services</li>
          <li>Load balancing and health monitoring</li>
          <li>Graceful degradation for non-critical services</li>
        </ul>
        
        <h3>Scalability Features</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li>Horizontal scaling for services based on demand</li>
          <li>Asynchronous request processing for improved throughput</li>
          <li>Efficient caching to reduce load on the blockchain</li>
          <li>Auto-scaling based on resource utilization metrics</li>
        </ul>
      </div>
      
      <h2>Network Architecture</h2>
      
      <div className="my-8">
        <p>
          The Neo Service Layer interacts with multiple networks and systems:
        </p>
        
        <Image 
          src="/images/docs/network-architecture.png" 
          alt="Neo Service Layer Network Architecture" 
          width={900} 
          height={500}
          className="my-8 border rounded-lg shadow-md"
          style={{maxWidth: '100%', height: 'auto'}}
        />
        
        <h3>Key Network Interfaces</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold">Client Applications</h4>
            <p className="pl-4">
              Applications interact with the service layer through HTTPS REST APIs or WebSocket connections.
              All external communications are encrypted and authenticated.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold">Neo N3 Blockchain</h4>
            <p className="pl-4">
              The service layer connects to Neo N3 nodes using RPC and WebSocket connections to monitor
              events, submit transactions, and interact with smart contracts.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold">External Data Sources</h4>
            <p className="pl-4">
              For oracle and price feed services, the layer connects to external data providers using
              secure HTTPS connections, with data validation and transformation in TEEs.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold">Internal Services</h4>
            <p className="pl-4">
              Service components communicate using gRPC with mutual TLS authentication and encryption,
              ensuring secure and efficient internal communication.
            </p>
          </div>
        </div>
      </div>
      
      <h2>Next Steps</h2>
      
      <div className="mt-8 space-y-6">
        <div className="border-l-4 border-primary pl-4 py-1">
          <h3 className="text-lg font-semibold mb-1">Service Documentation</h3>
          <p className="mb-2">
            Explore the detailed documentation for each service in the Neo Service Layer.
          </p>
          <Link href="/docs" className="text-primary hover:underline">
            View Services →
          </Link>
        </div>
        
        <div className="border-l-4 border-primary pl-4 py-1">
          <h3 className="text-lg font-semibold mb-1">Security Deep Dive</h3>
          <p className="mb-2">
            Learn more about the security features and model of the Neo Service Layer.
          </p>
          <Link href="/docs/security" className="text-primary hover:underline">
            View Security Documentation →
          </Link>
        </div>
        
        <div className="border-l-4 border-primary pl-4 py-1">
          <h3 className="text-lg font-semibold mb-1">Getting Started</h3>
          <p className="mb-2">
            Start building with the Neo Service Layer using our quickstart guides.
          </p>
          <Link href="/docs/getting-started" className="text-primary hover:underline">
            View Getting Started Guide →
          </Link>
        </div>
      </div>
    </div>
  );
} 