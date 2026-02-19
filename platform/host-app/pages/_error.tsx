import { NextPageContext } from "next";

type ErrorProps = {
  statusCode: number;
};

function Error({ statusCode }: ErrorProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#050810] text-gray-800 dark:text-gray-200">
      <div className="p-8 text-center">
        <h1 className="m-0 text-7xl font-bold text-neo">{statusCode}</h1>
        <p className="my-4 text-lg text-gray-400">
          {statusCode === 404 ? "Page not found" : "An error occurred on the server"}
        </p>
        <a
          href="/"
          className="inline-block rounded-lg bg-neo px-6 py-3 font-semibold text-black no-underline hover:bg-neo/90 transition-colors"
        >
          Go back home
        </a>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode: statusCode || 500 };
};

export default Error;
