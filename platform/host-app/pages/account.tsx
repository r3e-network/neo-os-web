import Head from "next/head";
import dynamic from "next/dynamic";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AccountContent = dynamic(() => import("@/components/features/account/AccountContent"), {
  ssr: false,
});

export default function AccountPage() {
  return (
    <Layout>
      <Head>
        <title>Account - Neo MiniApp Platform</title>
      </Head>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="mt-2 text-gray-600">Manage your wallet and linked accounts</p>

        <div className="mt-8 space-y-6">
          <AccountContent />
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = async () => ({ props: {} });
