import type { NextPageContext } from "next";
import Head from "next/head";

type ErrorProps = {
  statusCode: number;
};

function Error({ statusCode }: ErrorProps) {
  const is404 = statusCode === 404;
  const title = is404 ? "Page not found" : "Something went wrong";
  const message = is404
    ? "The page you're looking for doesn't exist or has been moved."
    : "An unexpected error occurred on the server. Please try again later.";

  return (
    <>
      <Head>
        <title>{`${statusCode} - ${title} | NeoHub`}</title>
      </Head>
      <div style={containerStyle}>
        {/* Background glow effect */}
        <div style={glowStyle} />
        <div style={contentStyle}>
          <div style={codeWrapperStyle}>
            <h1 style={codeStyle}>{statusCode}</h1>
          </div>
          <h2 style={titleStyle}>{title}</h2>
          <p style={messageStyle}>{message}</p>
          <a href="/" style={linkStyle}>
            Back to NeoHub
          </a>
        </div>
      </div>
    </>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode: statusCode || 500 };
};

export default Error;

/* E-Robo Design System colors:
 * --erobo-purple: #9f9df3
 * --erobo-purple-dark: #7b79d1
 * --erobo-ink: #1b1b2f
 * --erobo-ink-soft: #4a4a63
 * --erobo-mint: #d8f2e2
 * --erobo-peach: #f8d7c2
 */

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0a0a1a",
  color: "#e4e4e7",
  position: "relative",
  overflow: "hidden",
};

const glowStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -60%)",
  width: 500,
  height: 500,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(159,157,243,0.15) 0%, transparent 70%)",
  pointerEvents: "none",
};

const contentStyle: React.CSSProperties = {
  textAlign: "center",
  padding: 32,
  position: "relative",
  zIndex: 1,
};

const codeWrapperStyle: React.CSSProperties = {
  marginBottom: 8,
};

const codeStyle: React.CSSProperties = {
  fontSize: 96,
  fontWeight: 800,
  margin: 0,
  background: "linear-gradient(135deg, #9f9df3, #7b79d1)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  letterSpacing: "-0.02em",
};

const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  margin: "0 0 12px",
  color: "#e4e4e7",
};

const messageStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#4a4a63",
  margin: "0 0 32px",
  maxWidth: 400,
  lineHeight: 1.6,
};

const linkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "14px 32px",
  background: "linear-gradient(135deg, #9f9df3, #7b79d1)",
  color: "#1b1b2f",
  borderRadius: 12,
  fontWeight: 600,
  fontSize: 15,
  textDecoration: "none",
  transition: "transform 0.2s, box-shadow 0.2s",
  boxShadow: "0 4px 20px rgba(159, 157, 243, 0.3)",
};
