import type { NextPageContext } from "next";

function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{ textAlign: "center", padding: "4rem" }}>
      <h1>{statusCode || "Error"}</h1>
      <p>{statusCode === 404 ? "Page not found" : "An error occurred"}</p>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default ErrorPage;
