type PostgrestErrorShape = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

const MISSING_SCHEMA_CODES = new Set([
  "PGRST202", // Function missing in schema cache
  "PGRST205", // Table missing in schema cache
  "42P01", // relation does not exist
  "42883", // function does not exist
]);

const MISSING_SCHEMA_PATTERNS = [
  /could not find the table .* in the schema cache/i,
  /could not find the function .* in the schema cache/i,
  /relation .* does not exist/i,
  /function .* does not exist/i,
];

function asText(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function matchesMissingSchemaText(text: string): boolean {
  const input = asText(text);
  if (!input) return false;
  return MISSING_SCHEMA_PATTERNS.some((pattern) => pattern.test(input));
}

export function parsePostgrestErrorResponse(body: string): PostgrestErrorShape | null {
  const raw = asText(body).trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as PostgrestErrorShape;
  } catch {
    // Malformed error JSON — return null (caller handles gracefully)
    return null;
  }
}

export function isMissingSupabaseSchemaObject(input: unknown): boolean {
  if (!input) return false;

  if (typeof input === "string") {
    return matchesMissingSchemaText(input);
  }

  if (input instanceof Error) {
    return matchesMissingSchemaText(input.message);
  }

  if (typeof input === "object") {
    const error = input as PostgrestErrorShape;
    const code = asText(error.code).trim().toUpperCase();
    if (code && MISSING_SCHEMA_CODES.has(code)) return true;

    const combined = [error.message, error.details, error.hint].map(asText).join(" ");
    return matchesMissingSchemaText(combined);
  }

  return matchesMissingSchemaText(asText(input));
}
