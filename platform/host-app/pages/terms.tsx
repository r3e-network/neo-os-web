import Head from "next/head";
import Link from "next/link";
import { Layout, PageHero } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const sections = [
  {
    title: "Platform Access",
    body: "Yiwu provides a host interface for discovering and interacting with MiniApps. Users are responsible for reviewing each transaction before signing it with their wallet.",
  },
  {
    title: "On-chain Transactions",
    body: "Neo N3 transactions are irreversible after confirmation. The platform displays contract metadata and operation parameters, but the final authorization always belongs to the signing wallet.",
  },
  {
    title: "Developer Content",
    body: "MiniApp developers are responsible for the accuracy, safety, and maintenance of their submitted manifests, documentation, contracts, and media assets.",
  },
];

export default function TermsPage() {
  return (
    <Layout>
      <Head>
        <title>Terms of Service | Yiwu</title>
      </Head>

      <PageHero
        align="center"
        eyebrow="Legal"
        title="Terms of Service"
        description="Operational terms for using the Yiwu MiniApp platform and developer tooling."
      >
        <Link href="/privacy">
          <Button variant="outline">Privacy Policy</Button>
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
