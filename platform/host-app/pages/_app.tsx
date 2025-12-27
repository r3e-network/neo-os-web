import React from "react";
import type { AppProps } from "next/app";

// Global styles
const globalStyles = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background: #050810;
    min-height: 100vh;
    color: #e4e4e7;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
`;

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <style jsx global>
        {globalStyles}
      </style>
      <Component {...pageProps} />
    </>
  );
}
