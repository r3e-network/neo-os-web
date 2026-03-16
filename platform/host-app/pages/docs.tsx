import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import {
  Search,
  Rocket,
  Code2,
  ChevronRight,
  Copy,
  Check,
  Zap,
  Shield,
  FileCode,
  Layers,
  ExternalLink,
  Github,
  MessageCircle,
  Play,
  Database,
  Key,
  Cpu,
  Lock,
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
    <div className="relative group rounded-3xl bg-gray-900/90 dark:bg-[#0A0B10]/80 backdrop-blur-2xl border border-gray-800 dark:border-white/10 overflow-hidden shadow-2xl my-6">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 dark:border-white/5 bg-gray-800/50 dark:bg-white/5 text-gray-300">
        <span className="text-[10px] font-bold tracking-widest uppercase font-mono text-gray-400">{language}</span>
        <button type="button" onClick={handleCopy} aria-label="Copy code" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 hover:scale-105 transition-all cursor-pointer shadow-sm backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50">
          {copied ? <Check size={14} className="text-neo" /> : <Copy size={14} className="text-gray-300" />}
        </button>
      </div>
      <pre className="p-5 overflow-x-auto text-sm">
        <code className="text-[#a5d6ff] font-mono leading-relaxed tracking-wide">{code}</code>
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
        <section className="relative py-16 border-b border-gray-200 dark:border-gray-700">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-neo/10 blur-[120px] rounded-full" />
          </div>
          <div className="mx-auto max-w-7xl px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">Documentation</h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
                Everything you need to build powerful MiniApps on Neo N3
              </p>
              {/* Search */}
              <div className="relative max-w-xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={20} aria-hidden="true" />
                <input
                  type="text"
                  aria-label="Search documentation"
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-2 focus-visible:ring-neo/50 transition-all"
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
              <nav aria-label="Documentation sections" className="sticky top-24 space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      type="button"
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      aria-current={isActive ? "page" : undefined}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all cursor-pointer focus-visible:outline-none ${isActive
                        ? "border-l-2 border-neo bg-neo/5 shadow-[inset_0_0_20px_rgba(0,229,153,0.05)] text-neo font-bold"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 border-l-2 border-transparent"
                        }`}
                    >
                      <Icon size={18} aria-hidden="true" />
                      {section.title}
                    </button>
                  );
                })}

                {/* External Links */}
                <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700 space-y-1">
                  <a
                    href="https://github.com/neo-project"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                  >
                    <Github size={18} aria-hidden="true" />
                    GitHub
                    <ExternalLink size={14} className="ml-auto" aria-hidden="true" />
                  </a>
                  <a
                    href="https://discord.gg/neo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                    Discord
                    <ExternalLink size={14} className="ml-auto" aria-hidden="true" />
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
            <Rocket className="text-neo" size={24} aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Quick Start</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Get your first MiniApp running in under 5 minutes
            </p>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">1. Install the SDK</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">Install the Neo MiniApp SDK using npm or yarn:</p>
      <CodeBlock code="npm install @neo-miniapp/sdk" language="bash" />

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">2. Create Your App</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">Use our CLI to scaffold a new MiniApp project:</p>
      <CodeBlock code="npx create-miniapp my-first-app\ncd my-first-app\nnpm run dev" language="bash" />

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">3. Initialize the SDK</h3>
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

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">4. Make Your First Transaction</h3>
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
            <Play size={16} className="mr-2" aria-hidden="true" />
            Try It Now
          </Button>
        </Link>
        <a href="https://github.com/neo-project/neo-miniapp-template" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="border-gray-300 dark:border-gray-600">
            <Github size={16} className="mr-2" aria-hidden="true" />
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
          { icon: Lock, title: "Privacy API", desc: "Zero-knowledge asset transfers" },
        ].map((item) => (
          <div
            key={item.title}
            className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 transition-colors"
          >
            <div className="p-2 rounded-lg bg-neo/10">
              <item.icon className="text-neo" size={20} aria-hidden="true" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">{item.title}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
            </div>
            <ChevronRight className="ml-auto text-gray-500 dark:text-gray-400" size={16} aria-hidden="true" />
          </div>
        ))}
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">MiniApp Class</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">The main entry point for all SDK functionality:</p>
      <CodeBlock
        code={`// Browser / host-injected SDK
const sdk = window.MiniAppSDK;

// End-user modules
sdk.wallet;
sdk.payments;
sdk.governance;
sdk.rng;
sdk.datafeed;
sdk.stats;
sdk.events;
sdk.transactions;
sdk.gasSponsor;
sdk.privacy;

// Host-only modules are created separately via createHostSDK(...)
// host.oracle
// host.compute
// host.automation
// host.secrets`}
        language="typescript"
      />

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Wallet API</h3>
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

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Invoking Contracts</h3>
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

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Writing Your Own Contract</h3>
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

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Deploy Contract</h3>
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
            desc: "Allowlisted external fetches plus on-chain callback flows",
            color: "from-blue-500 to-cyan-500",
          },
          {
            icon: Key,
            title: "AA / Smart Wallet",
            desc: "External AA relay, verifiers, and gas sponsorship hooks",
            color: "from-amber-500 to-orange-500",
          },
          { icon: Lock, title: "NeoPrivacy Relayer", desc: "Zero-knowledge gasless transfers", color: "from-gray-500 to-slate-800" },
        ].map((item) => (
          <div
            key={item.title}
            className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700"
          >
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4`}
            >
              <item.icon className="text-white" size={24} aria-hidden="true" />
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Using VRF</h3>
      <CodeBlock
        code={`// End-user MiniApp flow
const randomResult = await window.MiniAppSDK.rng.requestRandom("miniapp-lottery");
console.log(randomResult.request_id, randomResult.randomness);
`}
        language="typescript"
      />

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Using Oracle</h3>
      <CodeBlock
        code={`// Public DataFeed read through the platform gateway
const price = await window.MiniAppSDK.datafeed.getPrice("NEO");
console.log(price.pair, price.price);

// Host-only allowlisted fetch
const host = createHostSDK({
  edgeBaseUrl: "https://<project>.supabase.co/functions/v1",
  getAPIKey: async () => "<host-api-key>",
});

const oracleRes = await host.oracle.query({
  url: "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
});
console.log(oracleRes.status_code, oracleRes.body);`}
        language="typescript"
      />

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Using TEE</h3>
      <CodeBlock
        code={`// Host-only inline compute
const computeResult = await host.compute.execute({
  script: "function main(){ return { ok: true, sum: input.a + input.b }; }",
  entry_point: "main",
  input: { a: 2, b: 3 },
});
console.log(computeResult.status, computeResult.output);

// If the script body is too large for request payloads, register it elsewhere
// and call the platform's registered-script path instead of inlining source.`}
        language="typescript"
      />

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Using AA Relay</h3>
      <CodeBlock
        code={`// Same-origin host proxy to the external AA relay
const relayResponse = await fetch("/api/aa/relay", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    metaInvocation: relayReadyInvocation,
    paymaster: { dapp_id: "demo-dapp" },
  }),
}).then((res) => res.json());

console.log(relayResponse.txid);`}
        language="typescript"
      />

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">Using Privacy Relayer (zNEP17)</h3>
      <CodeBlock
        code={`// 1. Get Merkle path to construct zero-knowledge proof
const path = await app.privacy.getMerklePath('0x...commitment');

// 2. Generate ZK-SNARK proof locally (using snarkjs or similar)
const proof = await generateZkProof(path, secret, nullifier);

// 3. Relay the transaction gaslessly
const tx = await app.privacy.relay({
  proof: proof.toString(),
  nullifierHash: proof.nullifierHash,
  root: path.root,
  recipient: 'NXX...',
  relayerFee: '10000',
  asset: 'GAS',
  amount: '500000000'
});

console.log('Privacy Tx Relayed:', tx.txHash);`}
        language="typescript"
      />
    </div>
  );
}
