"use client";

import Link from 'next/link';
import Image from 'next/image';

export default function RandomNumberDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Random Number Generation Service</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          The Random Number Generation Service provides secure, verifiable random numbers for
          Neo N3 smart contracts through a Trusted Execution Environment (TEE). This service
          is ideal for applications that require unpredictable randomness like gaming, gambling,
          NFT distribution, and fair selection processes.
        </p>
      </div>
      
      <h2>Key Features</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Verifiable Randomness</h3>
          <p>
            All random numbers come with cryptographic proof that they were generated fairly
            and were not manipulated.
          </p>
        </div>
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">TEE Security</h3>
          <p>
            Random number generation occurs in a Trusted Execution Environment (TEE), ensuring
            that not even the service operator can predict or manipulate the results.
          </p>
        </div>
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">On-chain Verification</h3>
          <p>
            Generated numbers include verification data that can be checked on-chain to
            confirm their authenticity and fairness.
          </p>
        </div>
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Direct Contract Integration</h3>
          <p>
            Random numbers can be delivered directly to smart contracts through our callback
            mechanism.
          </p>
        </div>
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Multiple Output Formats</h3>
          <p>
            Request integers within ranges, boolean values, or byte arrays depending on your
            application's needs.
          </p>
        </div>
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Subscription Model</h3>
          <p>
            Set up recurring random number deliveries for applications that need regular
            randomness, like lottery systems.
          </p>
        </div>
      </div>
      
      <h2>How It Works</h2>
      
      <div className="my-8">
        <h3>Architecture</h3>
        <p>
          The Random Number Generation Service uses a multi-layered approach to ensure entropy
          and verifiability:
        </p>
        
        <ol className="list-decimal pl-6 space-y-2 mb-6">
          <li>
            <strong>Request Intake:</strong> Your application or smart contract requests a
            random number through our API or via an on-chain event.
          </li>
          <li>
            <strong>TEE Processing:</strong> The request is processed in a Trusted Execution
            Environment where random data is generated using hardware-based entropy sources.
          </li>
          <li>
            <strong>Cryptographic Proof:</strong> The random number is signed with the TEE's
            private key, creating a verifiable attestation.
          </li>
          <li>
            <strong>Delivery:</strong> The random number and its proof are delivered to your
            application or smart contract.
          </li>
          <li>
            <strong>Verification:</strong> The recipient can verify the random number's
            authenticity using our on-chain verification contract.
          </li>
        </ol>
        
        <Image 
          src="/images/docs/random-service-flow.png" 
          alt="Random Number Service Flow" 
          width={800} 
          height={400}
          className="my-8 border rounded-lg shadow-md"
          style={{maxWidth: '100%', height: 'auto'}}
        />
      </div>
      
      <h2>Usage Examples</h2>
      
      <div className="my-8">
        <h3>Example 1: Basic Random Number Generation</h3>
        <p>Request a random number between 1 and 100:</p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example using the Neo Service Layer SDK
import { RandomService } from 'neo-service-layer-sdk';

// Initialize the service with your API key
const randomService = new RandomService({
  apiKey: 'your-api-key'
});

// Generate a random number between 1 and 100
const result = await randomService.generateRandomNumber({
  min: 1,
  max: 100,
  // Optional metadata for your application
  metadata: {
    purpose: 'lottery-draw',
    sessionId: 'abc123'
  }
});

console.log('Random number:', result.number);
console.log('Verification proof:', result.proof);
`}</pre>
      </div>
      
      <div className="my-8">
        <h3>Example 2: Smart Contract Integration</h3>
        <p>
          Request a random number directly to your smart contract using the callback pattern:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// NEO•ONE example of a lottery contract
import {
  SmartContract,
  SerializableValueObject,
  Address,
  constant,
  createEventNotifier,
  Fixed,
  MapStorage,
  Deploy
} from '@neo-one/smart-contract';

interface RandomNumberRequest {
  readonly requestId: string;
  readonly callbackContract: Address;
  readonly callbackMethod: string;
  readonly min: number;
  readonly max: number;
}

const notifyRandomNumberRequest = createEventNotifier<RandomNumberRequest>(
  'RandomNumberRequest'
);

export class LotteryContract extends SmartContract {
  private readonly participants = MapStorage.for<string, Address>();
  private readonly ticketCount = MapStorage.for<Address, number>();
  private readonly randomOracleAddress = Address.from('NXV7ZhHiyMU44Xyt5dGmQQNrwRnxZqTvex');
  
  @constant
  public get participantCount(): number {
    return this.participants.size;
  }
  
  public buyTicket(): boolean {
    const participant = this.transaction.sender;
    const ticketId = this.participantCount.toString();
    
    // Store participant information
    this.participants.set(ticketId, participant);
    const currentTickets = this.ticketCount.get(participant) || 0;
    this.ticketCount.set(participant, currentTickets + 1);
    
    return true;
  }
  
  @constant
  public getParticipant(ticketId: string): Address {
    return this.participants.get(ticketId);
  }
  
  public selectWinner(): void {
    // Ensure there are participants
    if (this.participantCount === 0) {
      throw new Error('No participants in the lottery');
    }
    
    // Create request ID (should be unique per request)
    const requestId = this.transaction.hash.toString();
    
    // Request a random number from the oracle
    notifyRandomNumberRequest({
      requestId,
      callbackContract: this.address,
      callbackMethod: 'processWinner',
      min: 0,
      max: this.participantCount - 1
    });
  }
  
  // Callback method that will be invoked by the random service
  public processWinner(requestId: string, randomIndex: number, proof: string): void {
    // Verify the caller is the oracle
    if (!this.transaction.sender.equals(this.randomOracleAddress)) {
      throw new Error('Unauthorized caller');
    }
    
    // Get the winning ticket ID and participant
    const winningTicketId = randomIndex.toString();
    const winner = this.getParticipant(winningTicketId);
    
    // Process winner (transfer prizes, etc.)
    // ...
  }
}`}</pre>
      </div>
      
      <div className="my-8">
        <h3>Example 3: Subscribing to Random Numbers</h3>
        <p>
          Set up a subscription to receive random numbers at regular intervals:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example using the Neo Service Layer SDK
import { RandomService } from 'neo-service-layer-sdk';

// Initialize the service with your API key
const randomService = new RandomService({
  apiKey: 'your-api-key'
});

// Create a subscription for daily random numbers
const subscription = await randomService.createSubscription({
  // Generate a random number between 1-1000 daily
  schedule: '0 0 * * *', // Cron syntax: at midnight every day
  configuration: {
    min: 1,
    max: 1000
  },
  // Where to send the random numbers
  destination: {
    type: 'webhook',
    url: 'https://your-app.com/api/random-callback'
  },
  // Optional metadata
  metadata: {
    name: 'Daily Lottery Draw',
    description: 'Random number for selecting daily winner'
  }
});

console.log('Subscription created:', subscription.id);
`}</pre>
      </div>
      
      <h2>Verifying Random Numbers</h2>
      
      <div className="my-8">
        <p>
          To verify that a random number was generated fairly, you can use our verification
          contract or SDK:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example of verifying a random number
import { RandomService } from 'neo-service-layer-sdk';

// Initialize the service
const randomService = new RandomService({
  apiKey: 'your-api-key'
});

// Verify a random number using its proof
const isValid = await randomService.verifyRandomNumber({
  randomNumber: 42,
  proof: 'proof-data-from-generation-response',
  requestId: 'original-request-id'
});

if (isValid) {
  console.log('Random number verified successfully!');
} else {
  console.error('Random number verification failed!');
}
`}</pre>

        <p className="mt-4">
          For on-chain verification, you can call our verification contract directly:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// NEO•ONE example of calling the verification contract
import { SmartContract, u, Address } from '@neo-one/smart-contract';

export class MyContract extends SmartContract {
  private readonly randomVerifierAddress = Address.from('NR19TBVdRfegCHf54UhdJRGkFagvDN7XM9');
  
  public verifyRandomNumber(
    randomNumber: number, 
    proof: string, 
    requestId: string
  ): boolean {
    // Create a call to the verification contract
    const verifierContract = SmartContract.for<{
      verify: (randomNumber: number, proof: string, requestId: string) => boolean;
    }>(this.randomVerifierAddress);
    
    // Call the verify method
    return verifierContract.verify(randomNumber, proof, requestId);
  }
}`}</pre>
      </div>
      
      <h2>Security Considerations</h2>
      
      <div className="my-8">
        <h3>Entropy Sources</h3>
        <p>
          Our random number generation relies on multiple sources of entropy:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Hardware-based random number generators in the TEE</li>
          <li>Environmental entropy from system timing variations</li>
          <li>Transaction-specific data for additional unpredictability</li>
        </ul>
        
        <h3>Front-Running Protection</h3>
        <p>
          To prevent front-running attacks (where observers attempt to predict or manipulate
          outcomes), the random service implements:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Commit-reveal schemes for on-chain randomness</li>
          <li>Time-delayed publication of random values</li>
          <li>Request-specific seeds that cannot be reused</li>
        </ul>
        
        <h3>Auditability</h3>
        <p>
          The random number generation process is designed to be auditable:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>All requests and responses are logged with timestamps</li>
          <li>TEE attestation documents are available for verification</li>
          <li>The verification contract's code is open source and audited</li>
        </ul>
      </div>
      
      <h2>Integration with Other Services</h2>
      
      <div className="my-8">
        <h3>Functions Service</h3>
        <p>
          You can use the Random Number Generation Service within your Functions:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// Example function that uses the random service
module.exports = async function(context) {
  // Access the random service from the context
  const { random } = context.services;
  
  // Generate a random number
  const result = await random.generate({
    min: 1,
    max: 100
  });
  
  return {
    randomNumber: result.number,
    proof: result.proof
  };
};`}</pre>
      </div>
      
      <div className="my-8">
        <h3>Automation Service</h3>
        <p>
          You can trigger random number generation based on time or events:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// Example automation configuration
{
  "triggers": [
    {
      "type": "schedule",
      "schedule": "0 12 * * *" // Every day at noon
    }
  ],
  "action": {
    "type": "random",
    "configuration": {
      "min": 1,
      "max": 1000,
      "destination": {
        "type": "contract",
        "scriptHash": "0x7a16a1f5c40e69790333f3bfe7e4325a08cc2f79",
        "operation": "processDailyDraw"
      }
    }
  }
}`}</pre>
      </div>
      
      <h2>API Reference</h2>
      
      <div className="my-8">
        <p>
          For a complete API reference, see the <Link href="/docs/api/random-api" className="text-primary hover:underline">Random Service API documentation</Link>.
        </p>
        
        <h3>Key Endpoints</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li><code>POST /v1/random/generate</code> - Generate a random number</li>
          <li><code>POST /v1/random/verify</code> - Verify a random number and its proof</li>
          <li><code>POST /v1/random/subscriptions</code> - Create a subscription</li>
          <li><code>GET /v1/random/subscriptions</code> - List your subscriptions</li>
          <li><code>GET /v1/random/history</code> - View your random number request history</li>
        </ul>
      </div>
      
      <h2>Pricing</h2>
      
      <div className="my-8">
        <p>
          The Random Number Generation Service is priced based on the number of random values generated:
        </p>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Plan</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Random Values</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Free Tier</td>
                <td className="border border-gray-300 px-4 py-2">Up to 1,000 / month</td>
                <td className="border border-gray-300 px-4 py-2">Free</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">Standard</td>
                <td className="border border-gray-300 px-4 py-2">Up to 100,000 / month</td>
                <td className="border border-gray-300 px-4 py-2">0.01 GAS per request</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Enterprise</td>
                <td className="border border-gray-300 px-4 py-2">Unlimited</td>
                <td className="border border-gray-300 px-4 py-2">Custom pricing</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <p className="mt-4">
          See the <Link href="/pricing" className="text-primary hover:underline">Pricing page</Link> for more details.
        </p>
      </div>
      
      <h2>Next Steps</h2>
      
      <div className="mt-8 space-y-6">
        <div className="border-l-4 border-primary pl-4 py-1">
          <h3 className="text-lg font-semibold mb-1">Examples</h3>
          <p className="mb-2">
            Explore complete examples of random number generation in different scenarios.
          </p>
          <Link href="/docs/examples/random" className="text-primary hover:underline">
            View examples →
          </Link>
        </div>
        
        <div className="border-l-4 border-primary pl-4 py-1">
          <h3 className="text-lg font-semibold mb-1">API Documentation</h3>
          <p className="mb-2">
            View the complete API reference for the Random Number Service.
          </p>
          <Link href="/docs/api/random-api" className="text-primary hover:underline">
            View API documentation →
          </Link>
        </div>
        
        <div className="border-l-4 border-primary pl-4 py-1">
          <h3 className="text-lg font-semibold mb-1">Integration Tutorials</h3>
          <p className="mb-2">
            Follow step-by-step tutorials for integrating random numbers in your applications.
          </p>
          <Link href="/docs/tutorials/random-integration" className="text-primary hover:underline">
            View tutorials →
          </Link>
        </div>
      </div>
    </div>
  );
} 