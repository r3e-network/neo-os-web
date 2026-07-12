export type MemorialDraftInput = {
  name: unknown;
  photoHash: unknown;
  relationship: unknown;
  birthYear: unknown;
  deathYear: unknown;
  biography: unknown;
  obituary: unknown;
};

export type NormalizedMemorialDraft = {
  name: string;
  photoHash: string;
  relationship: string;
  birthYear: number;
  deathYear: number;
  biography: string;
  obituary: string;
};

export type MemorialDraftValidation =
  | { ok: true; value: NormalizedMemorialDraft }
  | { ok: false; errorKey: string };

const TEXT_LIMITS = {
  name: 96,
  photoHash: 160,
  relationship: 64,
  biography: 600,
  obituary: 600,
} as const;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function parseOptionalYear(value: unknown, currentYear: number): number | null {
  const raw = text(value);
  if (!raw) return 0;
  if (!/^\d{1,4}$/.test(raw)) return null;
  const year = Number(raw);
  if (!Number.isSafeInteger(year) || year < 1 || year > currentYear) return null;
  return year;
}

export function isDisplayableMemorialPhoto(value: unknown): boolean {
  const raw = text(value);
  if (!raw) return true;
  if (raw.length > TEXT_LIMITS.photoHash) return false;

  if (/^https:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return Boolean(url.hostname) && !url.username && !url.password;
    } catch {
      return false;
    }
  }

  const cid = raw.replace(/^ipfs:\/\//i, "").replace(/^\/?ipfs\//i, "");
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid) || /^b[a-z2-7]{20,}$/i.test(cid);
}

export function validateMemorialDraft(
  input: MemorialDraftInput,
  currentYear = new Date().getFullYear(),
): MemorialDraftValidation {
  const value: NormalizedMemorialDraft = {
    name: text(input.name),
    photoHash: text(input.photoHash),
    relationship: text(input.relationship),
    birthYear: 0,
    deathYear: 0,
    biography: text(input.biography),
    obituary: text(input.obituary),
  };

  if (!value.name) return { ok: false, errorKey: "nameRequired" };
  if (value.name.length > TEXT_LIMITS.name) {
    return { ok: false, errorKey: "nameTooLong" };
  }
  if (value.relationship.length > TEXT_LIMITS.relationship) {
    return { ok: false, errorKey: "relationshipTooLong" };
  }
  if (value.biography.length > TEXT_LIMITS.biography) {
    return { ok: false, errorKey: "biographyTooLong" };
  }
  if (value.obituary.length > TEXT_LIMITS.obituary) {
    return { ok: false, errorKey: "obituaryTooLong" };
  }
  if (!isDisplayableMemorialPhoto(value.photoHash)) {
    return { ok: false, errorKey: "photoInvalid" };
  }

  const birthYear = parseOptionalYear(input.birthYear, currentYear);
  const deathYear = parseOptionalYear(input.deathYear, currentYear);
  if (birthYear === null || deathYear === null) {
    return { ok: false, errorKey: "yearInvalid" };
  }
  if (birthYear > 0 && deathYear > 0 && birthYear > deathYear) {
    return { ok: false, errorKey: "yearOrder" };
  }

  value.birthYear = birthYear;
  value.deathYear = deathYear;
  return { ok: true, value };
}
