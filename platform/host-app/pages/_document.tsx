import Document, { Head, Html, Main, NextScript, type DocumentContext, type DocumentInitialProps } from "next/document";

type Props = DocumentInitialProps & { nonce?: string };

export default class MyDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext): Promise<Props> {
    const initialProps = await Document.getInitialProps(ctx);
    const nonce = String(ctx.req?.headers["x-csp-nonce"] ?? "").trim() || undefined;
    return { ...initialProps, nonce };
  }

  render() {
    const nonce = this.props.nonce;
    const rpcOrigin = (() => {
      try {
        return new URL(process.env.NEO_RPC_TESTNET || "https://testnet1.neo.coz.io:443").origin;
      } catch {
        return "https://testnet1.neo.coz.io";
      }
    })();
    return (
      <Html lang="en">
        <Head>
          <meta charSet="utf-8" />
          {/* Resource hints — preconnect to high-priority origins so the
              browser opens connections (DNS + TCP + TLS) early.  DNS-prefetch
              covers lower-priority origins where a full preconnect is wasteful. */}
          <link rel="preconnect" href={rpcOrigin} crossOrigin="anonymous" />
          <link rel="preconnect" href="/miniapps" />
          <link rel="dns-prefetch" href={rpcOrigin} />
          <link rel="dns-prefetch" href="https://edge.meshmini.app" />
          <link rel="dns-prefetch" href="https://oracle.meshmini.app" />
          {process.env.NEXT_PUBLIC_EDGE_URL && (
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_EDGE_URL} />
          )}
          <meta name="description" content="Discover and use decentralized MiniApps on Neo N3" />
          <meta property="og:type" content="website" />
          <meta property="og:title" content="R3E Network - MiniApp Platform for Neo N3" />
          <meta property="og:description" content="Discover and use decentralized MiniApps on Neo N3" />
          <meta property="og:site_name" content="R3E Network" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="R3E Network - MiniApp Platform for Neo N3" />
          <meta name="twitter:description" content="Discover and use decentralized MiniApps on Neo N3" />
        </Head>
        <body>
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}
