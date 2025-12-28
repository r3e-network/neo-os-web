import Head from "next/head";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  { title: "Getting Started", desc: "Quick start guide for users", icon: "🚀" },
  { title: "SDK Reference", desc: "API documentation for developers", icon: "📚" },
  { title: "Smart Contracts", desc: "Contract integration guides", icon: "📜" },
  { title: "FAQ", desc: "Frequently asked questions", icon: "❓" },
];

export default function DocsPage() {
  return (
    <Layout>
      <Head>
        <title>Documentation - Neo MiniApp Platform</title>
      </Head>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold">Documentation</h1>
        <p className="mt-2 text-gray-600">Learn how to use and build on the platform</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {sections.map((s) => (
            <Card key={s.title} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">{s.icon}</span>
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = async () => ({ props: {} });
