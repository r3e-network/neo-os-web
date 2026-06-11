import { describe, expect, it } from "vitest";

import { eventStateValue, eventValue } from "../utils/chain-events";

describe("eventValue", () => {
  const entry = {
    state: [
      { type: "Integer", value: "42" },
      { type: "ByteString", value: "addr" },
      "bare-item",
      { type: "Any", value: null },
    ],
  };

  it("unwraps { value } items from the positional state array", () => {
    expect(eventValue(entry, 0)).toBe("42");
    expect(eventValue(entry, 1)).toBe("addr");
  });

  it("returns bare items as-is", () => {
    expect(eventValue(entry, 2)).toBe("bare-item");
  });

  it("returns the wrapped value even when it is null", () => {
    expect(eventValue(entry, 3)).toBeNull();
  });

  it("returns undefined for out-of-range slots", () => {
    expect(eventValue(entry, 9)).toBeUndefined();
  });

  it("returns undefined for malformed entries", () => {
    expect(eventValue(null, 0)).toBeUndefined();
    expect(eventValue(undefined, 0)).toBeUndefined();
    expect(eventValue("string", 0)).toBeUndefined();
    expect(eventValue({}, 0)).toBeUndefined();
    expect(eventValue({ state: "not-array" }, 0)).toBeUndefined();
  });
});

describe("eventStateValue", () => {
  it("unwraps { value } items from a { state } envelope", () => {
    const ev = { state: [{ type: "Integer", value: "7" }] };
    expect(eventStateValue(ev, 0)).toBe("7");
  });

  it("accepts a bare state array (no envelope)", () => {
    expect(eventStateValue([{ value: "x" }, "raw"], 0)).toBe("x");
    expect(eventStateValue([{ value: "x" }, "raw"], 1)).toBe("raw");
  });

  it("falls back to the raw item when value is null or undefined", () => {
    expect(eventStateValue({ state: [{ type: "Any", value: null }] }, 0)).toEqual({
      type: "Any",
      value: null,
    });
  });

  it("returns undefined when no array shape is found", () => {
    expect(eventStateValue(null, 0)).toBeUndefined();
    expect(eventStateValue({ state: "nope" }, 0)).toBeUndefined();
    expect(eventStateValue("string", 0)).toBeUndefined();
  });
});
