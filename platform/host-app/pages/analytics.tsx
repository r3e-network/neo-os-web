import Head from "next/head";
import { Layout, PageNotice } from "@/components/layout";

export default function AnalyticsPage() {
  return (
    <Layout>
      <Head>
        <title>Analytics Unavailable - R3E Network</title>
      </Head>
      <PageNotice
        eyebrow="Frontend policy"
        title="Analytics Are Temporarily Unavailable"
        description="Personal and platform analytics are hidden from the frontend until the next statistics pass is completed. Community ratings and comments are still active."
        primaryAction={{ href: "/miniapps", label: "Back to MiniApps" }}
        secondaryAction={{ href: "/account", label: "Open Account", variant: "outline" }}
      />
    </Layout>
  );
}
