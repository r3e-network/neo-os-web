import Head from "next/head";
import dynamic from "next/dynamic";
import { Layout, PageHero } from "@/components/layout";

const SecretsContent = dynamic(
  () => import("@/components/features/secrets/SecretsContent"),
  { ssr: false },
);

export default function SecretsPage() {
  return (
    <Layout>
      <Head>
        <title>Secrets - Neo Miniapps</title>
      </Head>
      <PageHero
        align="center"
        eyebrow="TEE"
        title="Secret Tokens"
        description="Manage tokens for TEE confidential computing — bind, list, and revoke per-app secrets without exposing key material to the host frontend."
      />
      <main className="mx-auto max-w-4xl px-4 pb-14">
        <SecretsContent />
      </main>
    </Layout>
  );
}
