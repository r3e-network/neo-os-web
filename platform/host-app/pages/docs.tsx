import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { Layout, PageHero } from "@/components/layout";
import { CodeBlock, IconFeatureGrid } from "@/components/content";
import { Button } from "@/components/ui/button";
import {
  Search,
  Rocket,
  Code2,
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

// Documentation sections
const sections = [
  { id: "getting-started", title: "Getting Started", icon: Rocket, keywords: ["start", "install", "wallet", "quick", "transaction"] },
  { id: "sdk-reference", title: "SDK Reference", icon: Code2, keywords: ["sdk", "api", "wallet", "privacy", "events", "datafeed"] },
  { id: "smart-contracts", title: "Smart Contracts", icon: FileCode, keywords: ["contract", "invoke", "deploy", "csharp", "neo"] },
  { id: "platform-services", title: "Platform Services", icon: Layers, keywords: ["oracle", "aa", "tee", "vrf", "privacy", "relay"] },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("getting-started");
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return sections;
    return sections.filter((section) => {
      const haystack = [section.title, ...section.keywords].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  useEffect(() => {
    if (!filteredSections.some((section) => section.id === activeSection)) {
      setActiveSection(filteredSections[0]?.id || "getting-started");
    }
  }, [activeSection, filteredSections]);

  return (
    <Layout>
      <Head>
        <title>Documentation | Neo MiniApp Platform</title>
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-950">
        <PageHero
          align="center"
          eyebrow="Reference"
          title="Documentation"
          description="Everything you need to build powerful MiniApps on Neo N3 with the current AA, oracle, and host app architecture."
          stats={[
            { label: "Sections", value: String(sections.length), hint: "Getting started, SDK, contracts, services" },
            { label: "Audience", value: "Builders", hint: "Platform operators and app developers" },
            { label: "Matches", value: String(filteredSections.length), hint: normalizedQuery ? `Filtered by "${searchQuery}"` : "All sections visible" },
          ]}
        >
          <div className="relative mx-auto max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={20} aria-hidden="true" />
            <input
              type="text"
              aria-label="Search documentation"
              id="docs-search-input"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 w-full rounded-xl border border-gray-200 bg-gray-100 pl-12 pr-4 text-gray-900 transition-all placeholder-gray-500 focus-visible:border-neo/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
            />
          </div>
        </PageHero>

        {/* Main Content */}
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Navigation */}
            <aside className="lg:w-64 shrink-0">
              <nav aria-label="Documentation sections" className="sticky top-24 space-y-1">
                {filteredSections.map((section) => {
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
                {!filteredSections.length && (
                  <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                    No documentation sections match the current search.
                  </div>
                )}
              </nav>
            </aside>

            {/* Content Area */}
            <main className="flex-1 min-w-0">
              {!filteredSections.length ? (
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                  Try searching for terms like <code className="rounded bg-white/60 px-1.5 py-0.5 dark:bg-white/10">oracle</code>,
                  <code className="ml-1 rounded bg-white/60 px-1.5 py-0.5 dark:bg-white/10">wallet</code>, or
                  <code className="ml-1 rounded bg-white/60 px-1.5 py-0.5 dark:bg-white/10">deploy</code>.
                </div>
              ) : (
                <>
                  {activeSection === "getting-started" && <GettingStartedContent />}
                  {activeSection === "sdk-reference" && <SDKReferenceContent />}
                  {activeSection === "smart-contracts" && <SmartContractsContent />}
                  {activeSection === "platform-services" && <PlatformServicesContent />}
                </>
              )}
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

      <IconFeatureGrid
        className="not-prose mb-8"
        columns={1}
        compact
        showChevron
        items={[
          { icon: Key, title: "Wallet API", description: "Connect wallets, sign transactions" },
          { icon: Database, title: "Storage API", description: "On-chain and off-chain storage" },
          { icon: Zap, title: "Events API", description: "Real-time blockchain events" },
          { icon: Shield, title: "TEE API", description: "Confidential computing" },
          { icon: Lock, title: "Privacy API", description: "Zero-knowledge asset transfers" },
        ]}
      />

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
sdk.events;
sdk.transactions;
sdk.gasSponsor;
sdk.privacy;

// Optional authenticated usage endpoint
// sdk.stats.getMyUsage(appId, date);

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

      <IconFeatureGrid
        className="not-prose mb-8"
        columns={2}
        items={[
          {
            icon: Shield,
            title: "TEE (Confidential Computing)",
            description: "Run private logic in secure enclaves",
            color: "from-purple-500 to-pink-500",
          },
          {
            icon: Zap,
            title: "VRF (Verifiable Randomness)",
            description: "Provably fair random numbers",
            color: "from-neo to-emerald-500",
          },
          {
            icon: Database,
            title: "Oracle Service",
            description: "Allowlisted external fetches plus on-chain callback flows",
            color: "from-blue-500 to-cyan-500",
          },
          {
            icon: Key,
            title: "AA / Smart Wallet",
            description: "External AA relay, verifiers, and gas sponsorship hooks",
            color: "from-amber-500 to-orange-500",
          },
          { icon: Lock, title: "NeoPrivacy Relayer", description: "Zero-knowledge gasless transfers", color: "from-gray-500 to-slate-800" },
        ]}
      />

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
