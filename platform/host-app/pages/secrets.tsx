import Head from "next/head";
import dynamic from "next/dynamic";
import { Layout } from "@/components/layout";

const SecretsContent = dynamic(() => import("@/components/features/secrets/SecretsContent"), { ssr: false });

export default function SecretsPage() {
  return (
    <Layout>
      <Head>
        <title>Secrets - Neo MiniApp Platform</title>
      </Head>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-bold">Secret Tokens</h1>
        <p className="mt-2 text-gray-600">Manage tokens for TEE confidential computing</p>
        <div className="mt-8">
          <SecretsContent />
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = async () => ({ props: {} });
