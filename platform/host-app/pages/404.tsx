import Head from "next/head";
import Link from "next/link";
import { ErrorArt } from "../../../apps/shared/components-react/illustrations";

export default function Custom404() {
  return (
    <>
      <Head>
        <title>Page not found · Yiwu MiniApps</title>
      </Head>
      <main
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-50 px-4 py-16 text-gray-800"
        aria-labelledby="not-found-heading"
      >
        {/* Soft brand glow background — matches PageHero radial-gradient treatment. */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(22,199,132,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(0,163,255,0.10),transparent_28%)]"
          aria-hidden="true"
        />
        <div className="max-w-md text-center">
          <ErrorArt size={150} title="Lost robot" className="mx-auto mb-6" />
          <p className="text-xs font-semibold uppercase tracking-wider text-neo">
            Error 404
          </p>
          <h1
            id="not-found-heading"
            className="mt-3 text-5xl font-black text-gray-900 sm:text-6xl"
          >
            Page not found
          </h1>
          <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
            The URL you tried may have moved or never existed. Head back to the
            home page or jump straight into the MiniApp catalog.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-neo px-5 py-3 text-sm font-semibold text-gray-900 transition-all hover:bg-neo/90 hover:shadow-[0_4px_14px_rgba(22,199,132,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
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
