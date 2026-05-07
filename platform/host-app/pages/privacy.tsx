import Head from "next/head";
import Link from "next/link";
import { Layout, PageHero } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const sections = [
  {
    title: "Wallet Data",
    body: "The host app uses connected wallet addresses to display balances, prepare contract calls, and show account-scoped activity. Private keys remain in the wallet or explicit local test adapter selected by the user.",
  },
  {
    title: "Platform Telemetry",
    body: "Operational metrics may be collected to measure reliability, catalog usage, and MiniApp health. Sensitive transaction signing material is not collected by analytics flows.",
  },
  {
    title: "Developer Submissions",
    body: "Submitted MiniApp metadata, media, manifests, and audit records are stored for review, publication, rollback, and platform integrity checks.",
  },
];

export default function PrivacyPage() {
  return (
    <Layout>
      <Head>
        <title>Privacy Policy | Yiwu</title>
      </Head>

      <PageHero
        align="center"
        eyebrow="Legal"
        title="Privacy Policy"
        description="How the MiniApp platform handles wallet-scoped data, telemetry, and developer submission records."
      >
        <Link href="/terms">
          <Button variant="outline">Terms of Service</Button>
        </Link>
      </PageHero>

      <main className="mx-auto max-w-4xl px-6 py-14">
        <div className="space-y-5">
          {sections.map((section) => (
            <Card key={section.title} className="p-6">
              <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{section.body}</p>
            </Card>
          ))}
        </div>
      </main>
    </Layout>
  );
}
