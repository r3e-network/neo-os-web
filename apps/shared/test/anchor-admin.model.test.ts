import { describe, expect, it } from "vitest";

import {
  groupAnchorAgents,
  isCompressedPublicKey,
  normalizeCandidateKey,
  normalizeWholeNeoInput,
} from "../components-react/v2/anchor-admin/model";

describe("anchor admin workspace model", () => {
  it("normalizes indivisible NEO input without rounding up", () => {
    expect(normalizeWholeNeoInput("003.9")).toBe("3");
    expect(normalizeWholeNeoInput("12 NEO")).toBe("12");
    expect(normalizeWholeNeoInput("abc")).toBe("");
  });

  it("accepts only compressed secp256r1-style candidate encodings", () => {
    const valid = `03${"a".repeat(64)}`;
    expect(isCompressedPublicKey(valid)).toBe(true);
    expect(isCompressedPublicKey(`0x${valid}`)).toBe(true);
    expect(normalizeCandidateKey(` 0x${valid} `)).toBe(valid);
    expect(isCompressedPublicKey(`04${"a".repeat(64)}`)).toBe(false);
    expect(isCompressedPublicKey("03dead")).toBe(false);
  });

  it("groups a complete 21-agent roster into three stable topology rows", () => {
    const agents = Array.from({ length: 21 }, (_, index) => index + 1);
    expect(groupAnchorAgents(agents)).toEqual([
      [1, 2, 3, 4, 5, 6, 7],
      [8, 9, 10, 11, 12, 13, 14],
      [15, 16, 17, 18, 19, 20, 21],
    ]);
  });
});
