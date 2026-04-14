export default function Custom404() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-800">
      <div className="p-8 text-center">
        <h1 className="m-0 text-7xl font-bold text-neo">404</h1>
        <p className="my-4 text-lg text-gray-500">Page not found</p>
        <a
          href="/"
          className="inline-block rounded-lg bg-neo px-6 py-3 font-semibold text-black no-underline transition-colors hover:bg-neo/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
        >
          Go back home
        </a>
      </div>
    </div>
  );
}
