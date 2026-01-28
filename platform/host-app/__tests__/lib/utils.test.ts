import { cn, sanitizeInput, isValidEmail, escapeHtml } from "@/lib/utils";

describe("cn (className merge)", () => {
  it("merges class names correctly", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    const showHidden = false;
    const showVisible = true;
    expect(cn("base", showHidden && "hidden", showVisible && "visible")).toBe("base visible");
  });

  it("merges tailwind classes correctly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("handles empty inputs", () => {
    expect(cn()).toBe("");
    expect(cn("")).toBe("");
  });

  it("handles arrays", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });
});

describe("sanitizeInput", () => {
  it("removes angle brackets", () => {
    expect(sanitizeInput("<script>alert(1)</script>")).toBe("scriptalert(1)/script");
  });

  it("removes javascript: protocol", () => {
    expect(sanitizeInput("javascript:alert(1)")).toBe("alert(1)");
    expect(sanitizeInput("JAVASCRIPT:alert(1)")).toBe("alert(1)");
  });

  it("removes event handlers", () => {
    expect(sanitizeInput("onclick=alert(1)")).toBe("alert(1)");
    expect(sanitizeInput("onmouseover = evil()")).toBe("evil()");
  });

  it("removes HTML entities", () => {
    expect(sanitizeInput("&lt;script&gt;")).toBe("script");
  });

  it("trims whitespace", () => {
    expect(sanitizeInput("  hello  ")).toBe("hello");
  });

  it("limits length to 1000 characters", () => {
    const longInput = "a".repeat(2000);
    expect(sanitizeInput(longInput).length).toBe(1000);
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizeInput(null as unknown as string)).toBe("");
    expect(sanitizeInput(123 as unknown as string)).toBe("");
    expect(sanitizeInput(undefined as unknown as string)).toBe("");
  });

  it("handles normal text", () => {
    expect(sanitizeInput("Hello World")).toBe("Hello World");
  });
});

describe("isValidEmail", () => {
  it("validates correct emails", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("user.name@domain.org")).toBe(true);
    expect(isValidEmail("user+tag@example.co.uk")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isValidEmail("invalid")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("test@")).toBe(false);
    expect(isValidEmail("test@.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects emails longer than 254 characters", () => {
    const longEmail = "a".repeat(250) + "@b.com";
    expect(isValidEmail(longEmail)).toBe(false);
  });

  it("returns false for non-string input", () => {
    expect(isValidEmail(null as unknown as string)).toBe(false);
    expect(isValidEmail(123 as unknown as string)).toBe(false);
  });
});

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    expect(escapeHtml("'hello'")).toBe("&#x27;hello&#x27;");
  });

  it("escapes forward slash", () => {
    expect(escapeHtml("a/b")).toBe("a&#x2F;b");
  });

  it("handles multiple special characters", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;",
    );
  });

  it("returns empty string for non-string input", () => {
    expect(escapeHtml(null as unknown as string)).toBe("");
    expect(escapeHtml(123 as unknown as string)).toBe("");
  });

  it("handles normal text without special chars", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
});
