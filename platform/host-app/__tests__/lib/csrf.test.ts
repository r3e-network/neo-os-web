import { generateCsrfToken, validateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import type { NextApiRequest, NextApiResponse } from "next";

describe("generateCsrfToken", () => {
  it("generates a 64-character hex string", () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateCsrfToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("validateCsrfToken", () => {
  const createMockRequest = (method: string, headerToken?: string, cookieToken?: string): NextApiRequest =>
    ({
      method,
      headers: headerToken ? { "x-csrf-token": headerToken } : {},
      cookies: cookieToken ? { "csrf-token": cookieToken } : {},
    }) as unknown as NextApiRequest;

  it("returns true for GET requests", () => {
    const req = createMockRequest("GET");
    expect(validateCsrfToken(req)).toBe(true);
  });

  it("returns true for HEAD requests", () => {
    const req = createMockRequest("HEAD");
    expect(validateCsrfToken(req)).toBe(true);
  });

  it("returns true for OPTIONS requests", () => {
    const req = createMockRequest("OPTIONS");
    expect(validateCsrfToken(req)).toBe(true);
  });

  it("returns false for POST without tokens", () => {
    const req = createMockRequest("POST");
    expect(validateCsrfToken(req)).toBe(false);
  });

  it("returns false for POST with only header token", () => {
    const req = createMockRequest("POST", "token123");
    expect(validateCsrfToken(req)).toBe(false);
  });

  it("returns false for POST with only cookie token", () => {
    const req = createMockRequest("POST", undefined, "token123");
    expect(validateCsrfToken(req)).toBe(false);
  });

  it("returns false for mismatched tokens", () => {
    const req = createMockRequest("POST", "token123", "token456");
    expect(validateCsrfToken(req)).toBe(false);
  });

  it("returns true for matching tokens", () => {
    const token = generateCsrfToken();
    const req = createMockRequest("POST", token, token);
    expect(validateCsrfToken(req)).toBe(true);
  });
});

describe("setCsrfCookie", () => {
  it("sets cookie with correct attributes", () => {
    const mockRes = {
      setHeader: jest.fn(),
    } as unknown as NextApiResponse;

    setCsrfCookie(mockRes, "test-token");

    expect(mockRes.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("csrf-token=test-token"));
    expect(mockRes.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("HttpOnly"));
    expect(mockRes.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("SameSite=Strict"));
  });
});
