import Head from "next/head";
import Link from "next/link";
import { NextPageContext } from "next";

type ErrorProps = {
  statusCode: number;
};

function Error({ statusCode }: ErrorProps) {
  const headline =
    statusCode === 404
      ? "Page not found"
      : statusCode >= 500
        ? "Server hiccup"
        : "Something went wrong";
  const body =
    statusCode === 404
      ? "The URL you tried may have moved or never existed."
      : statusCode >= 500
        ? "Our infrastructure had a brief issue handling that request. Try again in a moment."
        : "We hit an unexpected error while loading the page.";

  return (
    <>
      <Head>
        <title>{headline} · Yiwu MiniApps</title>
      </Head>
      <main
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-50 px-4 py-16 text-gray-800"
        aria-labelledby="error-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(0,229,153,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(0,163,255,0.10),transparent_28%)]"
          aria-hidden="true"
        />
        <div className="max-w-md text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-neo">
            Error {statusCode}
          </p>
          <h1
            id="error-heading"
            className="mt-3 text-5xl font-black text-gray-900 sm:text-6xl"
          >
            {headline}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
            {body}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-neo px-5 py-3 text-sm font-semibold text-gray-900 transition-all hover:bg-neo/90 hover:shadow-[0_4px_14px_rgba(0,229,153,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
            >
              Go to home
            </Link>
            <Link
              href="/miniapps"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-all hover:border-neo/40 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
            >
              Browse MiniApps
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode: statusCode || 500 };
};

export default Error;
