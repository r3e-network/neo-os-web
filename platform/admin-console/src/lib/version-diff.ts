export type VersionDiffEntry = {
  path: string;
  kind: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
};

type DiffFilters = {
  includePaths?: string[];
  excludePaths?: string[];
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function primitive(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function appendPath(base: string, segment: string): string {
  return base ? `${base}.${segment}` : segment;
}

function stringifyForCompare(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    // Fallback to String() for non-serializable values (e.g., functions, symbols)
    return String(value);
  }
}

function compareArray(path: string, before: unknown[], after: unknown[], out: VersionDiffEntry[]) {
  const max = Math.max(before.length, after.length);
  for (let i = 0; i < max; i += 1) {
    const childPath = `${path}[${i}]`;
    const beforeHas = i < before.length;
    const afterHas = i < after.length;

    if (!beforeHas && afterHas) {
      out.push({ path: childPath, kind: "added", after: after[i] });
      continue;
    }
    if (beforeHas && !afterHas) {
      out.push({ path: childPath, kind: "removed", before: before[i] });
      continue;
    }

    walkDiff(childPath, before[i], after[i], out);
  }
}

function compareRecord(path: string, before: JsonRecord, after: JsonRecord, out: VersionDiffEntry[]) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const sorted = Array.from(keys).sort((a, b) => a.localeCompare(b));

  for (const key of sorted) {
    const childPath = appendPath(path, key);
    const beforeHas = Object.prototype.hasOwnProperty.call(before, key);
    const afterHas = Object.prototype.hasOwnProperty.call(after, key);

    if (!beforeHas && afterHas) {
      out.push({ path: childPath, kind: "added", after: after[key] });
      continue;
    }

    if (beforeHas && !afterHas) {
      out.push({ path: childPath, kind: "removed", before: before[key] });
      continue;
    }

    walkDiff(childPath, before[key], after[key], out);
  }
}

function walkDiff(path: string, before: unknown, after: unknown, out: VersionDiffEntry[]) {
  if (before === after) return;

  if (primitive(before) || primitive(after)) {
    out.push({ path, kind: "changed", before, after });
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    compareArray(path, before, after, out);
    return;
  }

  if (isRecord(before) && isRecord(after)) {
    compareRecord(path, before, after, out);
    return;
  }

  if (stringifyForCompare(before) !== stringifyForCompare(after)) {
    out.push({ path, kind: "changed", before, after });
  }
}

export function diffVersionPayload(before: unknown, after: unknown): VersionDiffEntry[] {
  const out: VersionDiffEntry[] = [];
  walkDiff("", before, after, out);
  return out;
}

function shouldIncludePath(path: string, filters?: DiffFilters): boolean {
  if (!filters) return true;

  const include = Array.isArray(filters.includePaths) ? filters.includePaths.filter(Boolean) : [];
  const exclude = Array.isArray(filters.excludePaths) ? filters.excludePaths.filter(Boolean) : [];

  if (include.length > 0 && !include.some((prefix) => path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`))) {
    return false;
  }

  if (exclude.some((prefix) => path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`))) {
    return false;
  }

  return true;
}

export function filterDiffEntries(entries: VersionDiffEntry[], filters?: DiffFilters): VersionDiffEntry[] {
  if (!filters) return entries;
  return entries.filter((entry) => shouldIncludePath(entry.path, filters));
}

export function summarizeDiff(entries: VersionDiffEntry[]): {
  total: number;
  added: number;
  removed: number;
  changed: number;
} {
  return entries.reduce(
    (acc, entry) => {
      acc.total += 1;
      if (entry.kind === "added") acc.added += 1;
      else if (entry.kind === "removed") acc.removed += 1;
      else acc.changed += 1;
      return acc;
    },
    { total: 0, added: 0, removed: 0, changed: 0 },
  );
}

export function toCsvRow(value: unknown): string {
  const text = typeof value === "string"
    ? value
    : value === undefined
      ? ""
      : (() => { try { return JSON.stringify(value); } catch { return String(value); } })();

  return `"${String(text).replace(/"/g, '""')}"`;
}

export function diffEntriesToCsv(entries: VersionDiffEntry[]): string {
  const header = ["path", "kind", "before", "after"].join(",");
  const lines = entries.map((entry) => [
    toCsvRow(entry.path),
    toCsvRow(entry.kind),
    toCsvRow(entry.before),
    toCsvRow(entry.after),
  ].join(","));

  return [header, ...lines].join("\n");
}
