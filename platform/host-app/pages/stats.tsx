import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/Button";

export default function StatsPage() {
  return (
    <Layout>
      <Head>
        <title>Statistics Unavailable - R3E Network</title>
      </Head>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Statistics Are Temporarily Unavailable</h1>
        <p className="mt-4 text-base text-gray-500 dark:text-gray-400">
          Frontend statistics have been removed for now while the platform data pipeline is being reworked.
          Ratings, reviews, comments, and MiniApp operations remain available.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/miniapps">
            <Button>Browse MiniApps</Button>
          </Link>
          <Link href="/docs">
            <Button variant="outline">Read Docs</Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
