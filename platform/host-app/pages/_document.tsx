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
      <Html lang="en" className="dark" data-scroll-behavior="smooth">
        <Head>
          {/* Theme initialization script - must run before React hydrates */}
          <script src="/theme-init.js" />
          <meta charSet="utf-8" />
          <meta name="description" content="Discover and use decentralized MiniApps on Neo N3" />
          <link rel="icon" href="/logo.png" type="image/png" />
          <link rel="apple-touch-icon" href="/logo.png" />
          {/* Google Fonts - only Outfit is used in tailwind config */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap"
            rel="stylesheet"
          />
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
