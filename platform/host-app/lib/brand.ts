export const BRAND = {
  name: "Neo",
  nameZh: "Neo",
  productName: "Neo Miniapps",
  productNameZh: "Neo Miniapps",
  mark: "Neo",
  title: "Neo Miniapps | Small, focused apps for Neo N3",
  description:
    "Discover small, focused, production-ready MiniApps for Neo N3: games, payments, oracle tools, account abstraction, bridge workflows, and OneGate-ready operations.",
  tagline:
    "A marketplace of small, focused Neo MiniApps: independent, practical, polished, and ready for real wallet operations.",
  /**
   * Real support channel for user-facing "report a problem" affordances
   * (e.g. the ErrorBoundary "Report Issue" button). Points at the platform's
   * public issue tracker so reports land somewhere actionable instead of a
   * placeholder mailbox.
   */
  supportUrl: "https://github.com/r3e-network/neo-miniapp-platform/issues/new",
} as const;

/**
 * Build a prefilled issue URL for the support channel.
 * Returns `BRAND.supportUrl` with `title`/`body` query params so the report
 * arrives with the error context already attached.
 */
export function buildSupportIssueUrl(params: { title: string; body: string }): string {
  const url = new URL(BRAND.supportUrl);
  url.searchParams.set("title", params.title);
  url.searchParams.set("body", params.body);
  return url.toString();
}
