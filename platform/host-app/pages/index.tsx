import Head from "next/head";
import { useMemo } from "react";

export default function Home() {
  const entryUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    return (url.searchParams.get("entry_url") ?? "").trim();
  }, []);

  return (
    <>
      <Head>
        <title>Neo MiniApp Host</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ margin: "0 0 12px" }}>Neo MiniApp Host (Scaffold)</h1>
        <p style={{ margin: "0 0 16px", maxWidth: 720 }}>
          This is a minimal host scaffold. In production, enforce manifest policy,
          wallet permissions, and a strict postMessage bridge.
        </p>
        {!entryUrl ? (
          <div>
            <p>
              Provide an <code>entry_url</code> query param to embed a MiniApp.
            </p>
            <pre style={{ background: "#111", color: "#eee", padding: 12 }}>
              {`/ ?entry_url=https%3A%2F%2Fcdn.example.com%2Fapps%2Fdemo%2Findex.html`}
            </pre>
          </div>
        ) : (
          <iframe
            title="MiniApp"
            src={entryUrl}
            style={{
              width: "100%",
              height: "80vh",
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </main>
    </>
  );
}

