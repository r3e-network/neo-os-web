import Head from "next/head";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";

import BuiltinApp from "../src/components/BuiltinApp";

function BuiltinHostPage() {
  const router = useRouter();
  const appId = typeof router.query.app === "string" ? router.query.app : undefined;
  const view = typeof router.query.view === "string" ? router.query.view : undefined;
  const theme = typeof router.query.theme === "string" ? router.query.theme : "dark";

  return (
    <>
      <Head>
        <title>Neo Built-in MiniApps</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <BuiltinApp appId={appId} view={view} theme={theme} />
    </>
  );
}

// Disable SSR to avoid useRouter issues
export default dynamic(() => Promise.resolve(BuiltinHostPage), { ssr: false });
