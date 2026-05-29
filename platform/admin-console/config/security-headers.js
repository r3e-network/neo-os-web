function buildContentSecurityPolicy(nodeEnv = process.env.NODE_ENV) {
  const scriptSources = ["'self'", "'unsafe-inline'"];

  // Next.js dev tooling needs eval for source maps and refresh. Keep production
  // CSP strict so this does not weaken the deployed admin console.
  if (nodeEnv !== "production") {
    scriptSources.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

module.exports = { buildContentSecurityPolicy };
