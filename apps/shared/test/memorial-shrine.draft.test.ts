import { describe, expect, it } from "vitest";

import {
  isDisplayableMemorialPhoto,
  validateMemorialDraft,
} from "../../memorial-shrine/src/logic/memorial-draft";

const base = {
  name: "Loved one",
  photoHash: "",
  relationship: "Family",
  birthYear: "",
  deathYear: "",
  biography: "Remembered with warmth.",
  obituary: "",
};

describe("Memorial Shrine draft validation", () => {
  it("keeps dates optional and returns a normalized contract payload", () => {
    expect(validateMemorialDraft(base, 2026)).toEqual({
      ok: true,
      value: {
        ...base,
        birthYear: 0,
        deathYear: 0,
      },
    });
  });

  it("rejects malformed, future, and reversed year ranges", () => {
    expect(validateMemorialDraft({ ...base, birthYear: "19xx" }, 2026)).toEqual({
      ok: false,
      errorKey: "yearInvalid",
    });
    expect(validateMemorialDraft({ ...base, deathYear: "2027" }, 2026)).toEqual({
      ok: false,
      errorKey: "yearInvalid",
    });
    expect(
      validateMemorialDraft({ ...base, birthYear: "2020", deathYear: "2019" }, 2026),
    ).toEqual({ ok: false, errorKey: "yearOrder" });
  });

  it("accepts displayable HTTPS/IPFS references and rejects unusable photo text", () => {
    expect(isDisplayableMemorialPhoto("https://images.example/memorial.webp")).toBe(true);
    expect(isDisplayableMemorialPhoto("ipfs://bafybeigdyrztfixture234567abcdefghijklmnop")).toBe(true);
    expect(isDisplayableMemorialPhoto("portrait from my desktop")).toBe(false);
    expect(
      validateMemorialDraft({ ...base, photoHash: "portrait from my desktop" }, 2026),
    ).toEqual({ ok: false, errorKey: "photoInvalid" });
  });

  it("rejects contract text that exceeds the declared field bounds", () => {
    expect(validateMemorialDraft({ ...base, name: "x".repeat(97) }, 2026)).toEqual({
      ok: false,
      errorKey: "nameTooLong",
    });
    expect(
      validateMemorialDraft({ ...base, biography: "x".repeat(601) }, 2026),
    ).toEqual({ ok: false, errorKey: "biographyTooLong" });
  });
});
