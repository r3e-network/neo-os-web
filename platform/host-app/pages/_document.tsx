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
    return (
      <Html lang="en">
        <Head>
          <meta charSet="utf-8" />
          <meta name="description" content="Discover and use decentralized MiniApps on Neo N3" />
          {/* Security Headers - Additional layer beyond middleware */}
          <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
          <meta httpEquiv="X-Frame-Options" content="DENY" />
          <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
          <meta name="referrer" content="strict-origin-when-cross-origin" />
          <meta httpEquiv="Permissions-Policy" content="geolocation=(), microphone=(), camera=()" />
        </Head>
        <body>
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}
