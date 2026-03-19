import Head from "next/head";
import { Layout, PageNotice } from "@/components/layout";

export default function StatsPage() {
  return (
    <Layout>
      <Head>
        <title>Statistics Unavailable - R3E Network</title>
      </Head>
      <PageNotice
        eyebrow="Frontend policy"
        title="Statistics Are Temporarily Unavailable"
        description="Frontend statistics have been removed for now while the platform data pipeline is being reworked. Ratings, reviews, comments, and MiniApp operations remain available."
        primaryAction={{ href: "/miniapps", label: "Browse MiniApps" }}
        secondaryAction={{ href: "/docs", label: "Read Docs", variant: "outline" }}
      />
    </Layout>
  );
}
