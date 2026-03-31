import { assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { parseDecimalToInt } from "./amount.ts";

// ---------------------------------------------------------------------------
// Basic conversions
// ---------------------------------------------------------------------------

Deno.test("parseDecimalToInt converts 1.0 to 100000000 (8 decimals)", () => {
  assertEquals(parseDecimalToInt("1.0", 8), 100_000_000n);
});

Deno.test("parseDecimalToInt handles 0", () => {
  assertEquals(parseDecimalToInt("0", 8), 0n);
});

Deno.test("parseDecimalToInt handles 0.0", () => {
  assertEquals(parseDecimalToInt("0.0", 8), 0n);
});

Deno.test("parseDecimalToInt converts whole numbers without decimal point", () => {
  assertEquals(parseDecimalToInt("5", 8), 500_000_000n);
});

Deno.test("parseDecimalToInt converts max precision (8 decimals)", () => {
  assertEquals(parseDecimalToInt("1.12345678", 8), 112_345_678n);
});

Deno.test("parseDecimalToInt pads fractional part to full precision", () => {
  // "1.5" with 8 decimals => 1.50000000 => 150000000
  assertEquals(parseDecimalToInt("1.5", 8), 150_000_000n);
});

Deno.test("parseDecimalToInt handles large whole number", () => {
  assertEquals(parseDecimalToInt("1000000", 8), 100_000_000_000_000n);
});

Deno.test("parseDecimalToInt works with fewer decimals (2)", () => {
  assertEquals(parseDecimalToInt("1.25", 2), 125n);
});

Deno.test("parseDecimalToInt works with zero decimals", () => {
  assertEquals(parseDecimalToInt("42", 0), 42n);
});

// ---------------------------------------------------------------------------
// Whitespace handling
// ---------------------------------------------------------------------------

Deno.test("parseDecimalToInt trims surrounding whitespace", () => {
  assertEquals(parseDecimalToInt("  3.14  ", 8), 314_000_000n);
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

Deno.test("parseDecimalToInt throws on empty string", () => {
  assertThrows(() => parseDecimalToInt("", 8), Error, "amount is required");
});

Deno.test("parseDecimalToInt throws on whitespace-only string", () => {
  assertThrows(() => parseDecimalToInt("   ", 8), Error, "amount is required");
});

Deno.test("parseDecimalToInt throws on negative value", () => {
  assertThrows(() => parseDecimalToInt("-1.0", 8), Error, "amount must be >= 0");
});

Deno.test("parseDecimalToInt throws on too many decimals", () => {
  assertThrows(
    () => parseDecimalToInt("1.123456789", 8),
    Error,
    "too many decimals (max 8)",
  );
});

Deno.test("parseDecimalToInt throws on non-numeric input", () => {
  assertThrows(() => parseDecimalToInt("abc", 8), Error, "invalid amount format");
});

Deno.test("parseDecimalToInt throws on mixed alphanumeric", () => {
  assertThrows(() => parseDecimalToInt("12abc", 8), Error, "invalid amount format");
});

Deno.test("parseDecimalToInt throws on multiple decimal points", () => {
  assertThrows(() => parseDecimalToInt("1.2.3", 8), Error, "invalid amount format");
});
