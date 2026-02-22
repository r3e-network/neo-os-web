import {
  APP_ID_REGEX,
  VERSION_ID_REGEX,
  asTrimmedString,
  parseReleaseChannel,
  parseRollbackReleaseChannel,
  parseVersionNo,
} from "@/pages/api/miniapps/admin/version-utils";

describe("miniapp admin version utils", () => {
  it("parses release channel values", () => {
    expect(parseReleaseChannel("draft")).toBe("draft");
    expect(parseReleaseChannel("published")).toBe("published");
    expect(parseReleaseChannel("all")).toBe("all");
    expect(parseReleaseChannel("unknown")).toBe("all");
  });

  it("parses rollback release channel with fallback", () => {
    expect(parseRollbackReleaseChannel("draft")).toBe("draft");
    expect(parseRollbackReleaseChannel("published")).toBe("published");
    expect(parseRollbackReleaseChannel("all")).toBe("published");
  });

  it("parses version numbers", () => {
    expect(parseVersionNo(1)).toBe(1);
    expect(parseVersionNo("12")).toBe(12);
    expect(parseVersionNo("0")).toBeNull();
    expect(parseVersionNo("abc")).toBeNull();
  });

  it("normalizes trimmed strings", () => {
    expect(asTrimmedString("  hello ")).toBe("hello");
    expect(asTrimmedString(null)).toBe("");
    expect(asTrimmedString(undefined)).toBe("");
  });

  it("matches app id and version id regex", () => {
    expect(APP_ID_REGEX.test("miniapp-market")).toBe(true);
    expect(APP_ID_REGEX.test("INVALID!!!")).toBe(false);

    expect(VERSION_ID_REGEX.test("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(VERSION_ID_REGEX.test("not-a-uuid")).toBe(false);
  });
});
