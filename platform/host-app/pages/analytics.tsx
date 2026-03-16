import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";

export default function AnalyticsPage() {
  return (
    <Layout>
      <Head>
        <title>Analytics Unavailable - R3E Network</title>
      </Head>
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Analytics Are Temporarily Unavailable</h1>
        <p className="mt-4 text-base text-gray-500 dark:text-gray-400">
          Personal and platform analytics are hidden from the frontend until the next statistics pass is completed.
          Community ratings and comments are still active.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/miniapps">
            <Button>Back to MiniApps</Button>
          </Link>
          <Link href="/account">
            <Button variant="outline">Open Account</Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
