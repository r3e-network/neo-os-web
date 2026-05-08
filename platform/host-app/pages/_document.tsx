import Document, {
  Head,
  Html,
  Main,
  NextScript,
  type DocumentContext,
  type DocumentInitialProps,
} from "next/document";
import { BRAND } from "@/lib/brand";

type Props = DocumentInitialProps & { nonce?: string };

export default class MyDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext): Promise<Props> {
    const initialProps = await Document.getInitialProps(ctx);
    const nonce =
      String(ctx.req?.headers["x-csp-nonce"] ?? "").trim() || undefined;
    return { ...initialProps, nonce };
  }

  render() {
    const nonce = this.props.nonce;
    const rpcOrigin = (() => {
      try {
        return new URL(
          process.env.NEO_RPC_TESTNET || "https://testnet1.neo.coz.io:443",
        ).origin;
      } catch {
        return "https://testnet1.neo.coz.io";
      }
    })();
    return (
      <Html lang="en">
        <Head>
          <meta charSet="utf-8" />
          {/* Resource hints — preconnect to high-priority origins so the
 browser opens connections (DNS + TCP + TLS) early. DNS-prefetch
 covers lower-priority origins where a full preconnect is wasteful. */}
          <link rel="preconnect" href={rpcOrigin} crossOrigin="anonymous" />
          <link rel="preconnect" href="/miniapps" />
          <link rel="dns-prefetch" href={rpcOrigin} />
          <link rel="dns-prefetch" href="https://edge.meshmini.app" />
          <link rel="dns-prefetch" href="https://oracle.meshmini.app" />
          {process.env.NEXT_PUBLIC_EDGE_URL && (
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_EDGE_URL} />
          )}
          <meta
            name="description"
            content={BRAND.description}
          />
          <meta name="theme-color" content="#00e599" />
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="icon" href="/brand/yiwu-mark.svg" type="image/svg+xml" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />
          <meta property="og:type" content="website" />
          <meta
            property="og:title"
            content={BRAND.title}
          />
          <meta
            property="og:description"
            content={BRAND.description}
          />
          <meta property="og:site_name" content={BRAND.productName} />
          <meta property="og:image" content="/brand/yiwu-logo.png" />
          <meta property="og:image:width" content="1520" />
          <meta property="og:image:height" content="440" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta
            name="twitter:title"
            content={BRAND.title}
          />
          <meta
            name="twitter:description"
            content={BRAND.description}
          />
          <meta name="twitter:image" content="/brand/yiwu-logo.png" />
        </Head>
        <body>
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}
