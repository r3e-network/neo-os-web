import { describe, expect, it } from "vitest";

const { buildContentSecurityPolicy } = require("../../../config/security-headers.js");

describe("admin console Next config", () => {
  it("disables the Next dev indicator so local QA screenshots show only app UI", () => {
    const nextConfig = require("../../../next.config.js");

    expect(nextConfig.devIndicators).toBe(false);
  });

  it("allows eval only for local development tooling", () => {
    expect(buildContentSecurityPolicy("development")).toContain(
      "'unsafe-eval'",
    );
  });

  it("keeps the production script policy free of unsafe eval", () => {
    expect(buildContentSecurityPolicy("production")).not.toContain(
      "'unsafe-eval'",
    );
  });
});
