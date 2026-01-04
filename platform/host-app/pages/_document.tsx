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
          <link rel="icon" href="/logo-icon.png" type="image/png" />
          <link rel="apple-touch-icon" href="/logo-icon.png" />
          {/* Google Fonts for beautiful typography */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Orbitron:wght@700;900&family=Playfair+Display:wght@700&family=Poppins:wght@600;700&family=Righteous&family=Space+Grotesk:wght@600;700&display=swap"
            rel="stylesheet"
          />
          {/* Security Headers - Additional layer beyond middleware */}
          <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
          {/* X-Frame-Options must be set via HTTP header, not meta tag */}
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
