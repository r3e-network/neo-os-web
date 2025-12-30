import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Search,
  Rocket,
  Code2,
  ChevronRight,
  Copy,
  Check,
  Zap,
  Shield,
  Terminal,
  FileCode,
  Layers,
  ExternalLink,
  Github,
  MessageCircle,
  Play,
  BookOpen,
  Database,
  Key,
  Cpu,
} from "lucide-react";
import { motion } from "framer-motion";

// Code block component with copy functionality
function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-xl bg-gray-900 dark:bg-black/50 border border-gray-800 dark:border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 dark:border-white/10 bg-gray-800/50">
        <span className="text-xs text-gray-400 font-mono">{language}</span>
        <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-white/10 transition-colors">
          {copied ? <Check size={14} className="text-neo" /> : <Copy size={14} className="text-gray-400" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="text-neo font-mono">{code}</code>
      </pre>
    </div>
  );
}

// Documentation sections
const sections = [
  { id: "getting-started", title: "Getting Started", icon: Rocket },
  { id: "sdk-reference", title: "SDK Reference", icon: Code2 },
  { id: "smart-contracts", title: "Smart Contracts", icon: FileCode },
  { id: "platform-services", title: "Platform Services", icon: Layers },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("getting-started");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <Layout>
      <Head>
        <title>Documentation | Neo MiniApp Platform</title>
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-950">
        {/* Hero Header */}
        <section className="relative py-16 border-b border-gray-200 dark:border-white/10">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-neo/10 blur-[120px] rounded-full" />
          </div>
          <div className="mx-auto max-w-7xl px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">Documentation</h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
                Everything you need to build powerful MiniApps on Neo N3
              </p>
              {/* Search */}
              <div className="relative max-w-xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-neo/50 focus:ring-1 focus:ring-neo/50 transition-all"
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Main Content */}
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Navigation */}
            <aside className="lg:w-64 shrink-0">
              <nav className="sticky top-24 space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                        isActive
                          ? "bg-neo/10 text-neo font-medium"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <Icon size={18} />
                      {section.title}
                    </button>
                  );
                })}

                {/* External Links */}
                <div className="pt-6 mt-6 border-t border-gray-200 dark:border-white/10 space-y-1">
                  <a
                    href="https://github.com/neo-project"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                  >
                    <Github size={18} />
                    GitHub
                    <ExternalLink size={14} className="ml-auto" />
                  </a>
                  <a
                    href="https://discord.gg/neo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                  >
                    <MessageCircle size={18} />
                    Discord
                    <ExternalLink size={14} className="ml-auto" />
                  </a>
                </div>
              </nav>
            </aside>

            {/* Content Area */}
            <main className="flex-1 min-w-0">
              {activeSection === "getting-started" && <GettingStartedContent />}
              {activeSection === "sdk-reference" && <SDKReferenceContent />}
              {activeSection === "smart-contracts" && <SmartContractsContent />}
              {activeSection === "platform-services" && <PlatformServicesContent />}
            </main>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Getting Started Content
function GettingStartedContent() {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Getting Started</h2>

      <div className="not-prose mb-8 p-6 rounded-2xl bg-neo/5 border border-neo/20">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-neo/10">
            <Rocket className="text-neo" size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Quick Start</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Get your first MiniApp running in under 5 minutes
            </p>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">1. Install the SDK</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">Install the Neo MiniApp SDK using npm or yarn:</p>
      <CodeBlock code="npm install @neo-miniapp/sdk" language="bash" />

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">2. Create Your App</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">Use our CLI to scaffold a new MiniApp project:</p>
      <CodeBlock code="npx create-miniapp my-first-app\ncd my-first-app\nnpm run dev" language="bash" />

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">3. Initialize the SDK</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">Import and initialize the SDK in your app:</p>
      <CodeBlock
        code={`import { MiniApp } from '@neo-miniapp/sdk';

const app = new MiniApp({
  appId: 'my-first-app',
  network: 'testnet', // or 'mainnet'
});

// Connect to wallet
const account = await app.wallet.connect();
console.log('Connected:', account.address);`}
        language="typescript"
      />

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">4. Make Your First Transaction</h3>
      <CodeBlock
        code={`// Transfer GAS
const result = await app.wallet.transfer({
  to: 'NXxx...recipient',
  asset: 'GAS',
  amount: '1.5',
});

console.log('TX Hash:', result.txid);`}
        language="typescript"
      />

      <div className="not-prose mt-8 flex gap-4">
        <Link href="/developer">
          <Button className="bg-neo hover:bg-neo/90 text-gray-900">
            <Play size={16} className="mr-2" />
            Try It Now
          </Button>
        </Link>
        <a href="https://github.com/neo-project/neo-miniapp-template" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="border-gray-300 dark:border-white/20">
            <Github size={16} className="mr-2" />
            View Template
          </Button>
        </a>
      </div>
    </div>
  );
}

// SDK Reference Content
function SDKReferenceContent() {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">SDK Reference</h2>

      <div className="not-prose grid gap-4 mb-8">
        {[
          { icon: Key, title: "Wallet API", desc: "Connect wallets, sign transactions" },
          { icon: Database, title: "Storage API", desc: "On-chain and off-chain storage" },
          { icon: Zap, title: "Events API", desc: "Real-time blockchain events" },
          { icon: Shield, title: "TEE API", desc: "Confidential computing" },
        ].map((item) => (
          <div
            key={item.title}
            className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-white/10 hover:border-neo/30 transition-colors cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-neo/10">
              <item.icon className="text-neo" size={20} />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">{item.title}</h4>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
            <ChevronRight className="ml-auto text-gray-400" size={16} />
          </div>
        ))}
      </div>

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">MiniApp Class</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">The main entry point for all SDK functionality:</p>
      <CodeBlock
        code={`interface MiniAppConfig {
  appId: string;
  network: 'mainnet' | 'testnet';
  permissions?: Permission[];
}

const app = new MiniApp(config: MiniAppConfig);

// Available modules
app.wallet    // Wallet operations
app.contract  // Smart contract calls
app.storage   // Data storage
app.vrf       // Verifiable randomness
app.oracle    // Price feeds & external data
app.tee       // Confidential computing`}
        language="typescript"
      />

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Wallet API</h3>
      <CodeBlock
        code={`// Connect wallet
const account = await app.wallet.connect();

// Get balance
const balance = await app.wallet.getBalance(account.address);
console.log('NEO:', balance.neo, 'GAS:', balance.gas);

// Sign message
const signature = await app.wallet.signMessage('Hello Neo!');

// Transfer assets
const tx = await app.wallet.transfer({
  to: 'NXxx...',
  asset: 'GAS',
  amount: '10',
});`}
        language="typescript"
      />
    </div>
  );
}

// Smart Contracts Content
function SmartContractsContent() {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Smart Contracts</h2>

      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Interact with Neo N3 smart contracts directly from your MiniApp.
      </p>

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Invoking Contracts</h3>
      <CodeBlock
        code={`// Invoke a contract method
const result = await app.contract.invoke({
  scriptHash: '0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5', // NEO
  operation: 'balanceOf',
  args: [
    { type: 'Hash160', value: account.address }
  ],
});

console.log('Balance:', result);`}
        language="typescript"
      />

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Writing Your Own Contract</h3>
      <CodeBlock
        code={`// MyMiniApp.cs
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

public class MyMiniApp : SmartContract
{
    public static void Main(string operation, object[] args)
    {
        if (operation == "play")
        {
            Play((UInt160)args[0], (BigInteger)args[1]);
        }
    }

    private static void Play(UInt160 player, BigInteger amount)
    {
        // Your game logic here
        Runtime.Notify("GamePlayed", player, amount);
    }
}`}
        language="csharp"
      />

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Deploy Contract</h3>
      <CodeBlock
        code={`# Compile contract
nccs MyMiniApp.cs

# Deploy to testnet
neo-cli deploy MyMiniApp.nef --network testnet`}
        language="bash"
      />
    </div>
  );
}

// Platform Services Content
function PlatformServicesContent() {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Platform Services</h2>

      <div className="not-prose grid md:grid-cols-2 gap-4 mb-8">
        {[
          {
            icon: Shield,
            title: "TEE (Confidential Computing)",
            desc: "Run private logic in secure enclaves",
            color: "from-purple-500 to-pink-500",
          },
          {
            icon: Zap,
            title: "VRF (Verifiable Randomness)",
            desc: "Provably fair random numbers",
            color: "from-neo to-emerald-500",
          },
          {
            icon: Database,
            title: "Oracle Service",
            desc: "Real-time external data feeds",
            color: "from-blue-500 to-cyan-500",
          },
          { icon: Cpu, title: "Automation", desc: "Scheduled task execution", color: "from-orange-500 to-yellow-500" },
        ].map((item) => (
          <div
            key={item.title}
            className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-white/10"
          >
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4`}
            >
              <item.icon className="text-white" size={24} />
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h4>
            <p className="text-sm text-gray-500">{item.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Using VRF</h3>
      <CodeBlock
        code={`// Request verifiable random number
const randomResult = await app.vrf.requestRandom({
  seed: 'my-game-round-123',
  callback: 'onRandomReceived',
});

// The random number is verifiable on-chain
console.log('Random:', randomResult.value);
console.log('Proof:', randomResult.proof);`}
        language="typescript"
      />

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Using Oracle</h3>
      <CodeBlock
        code={`// Get price feed
const price = await app.oracle.getPrice('NEO/USD');
console.log('NEO Price:', price.value, 'USD');

// Subscribe to price updates
app.oracle.subscribe('GAS/USD', (update) => {
  console.log('New GAS price:', update.value);
});`}
        language="typescript"
      />

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Using TEE</h3>
      <CodeBlock
        code={`// Execute confidential computation
const result = await app.tee.execute({
  function: 'computeWinner',
  inputs: {
    participants: ['player1', 'player2', 'player3'],
    seed: randomResult.value,
  },
  // Inputs are encrypted, only TEE can see them
  encrypted: true,
});

// Result is attested by the TEE
console.log('Winner:', result.output);
console.log('Attestation:', result.attestation);`}
        language="typescript"
      />
    </div>
  );
}

export const getServerSideProps = async () => ({ props: {} });
