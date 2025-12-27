import { NextPageContext } from "next";

type ErrorProps = {
  statusCode: number;
};

function Error({ statusCode }: ErrorProps) {
  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <h1 style={codeStyle}>{statusCode}</h1>
        <p style={messageStyle}>{statusCode === 404 ? "Page not found" : "An error occurred on the server"}</p>
        <a href="/" style={linkStyle}>
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

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#050810",
  color: "#e4e4e7",
};

const contentStyle: React.CSSProperties = {
  textAlign: "center",
  padding: 32,
};

const codeStyle: React.CSSProperties = {
  fontSize: 72,
  fontWeight: 700,
  margin: 0,
  color: "#00d4aa",
};

const messageStyle: React.CSSProperties = {
  fontSize: 18,
  color: "#a1a1aa",
  margin: "16px 0 24px",
};

const linkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 24px",
  background: "#00d4aa",
  color: "#000",
  borderRadius: 8,
  fontWeight: 600,
  textDecoration: "none",
};
