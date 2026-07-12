import { describe, expect, it } from "vitest";

import { disassembleScript } from "../../neo-convert/src/services/neo";

/**
 * These fixtures exercise Neo N3 (NeoVM) opcode framing. The disassembler must
 * NOT use Neo Legacy (NEO2) PUSHBYTES semantics. Reference opcode values:
 *   0x0C PUSHDATA1, 0x0D PUSHDATA2, 0x0E PUSHDATA4,
 *   0x00..0x05 PUSHINT8..256, 0x10..0x20 PUSH0..PUSH16,
 *   0x40 RET, 0x41 SYSCALL, 0x21 NOP.
 */
describe("disassembleScript (Neo N3 semantics)", () => {
  it("returns an empty array for non-hex input", () => {
    expect(disassembleScript("not-hex!")).toEqual([]);
    expect(disassembleScript("")).toEqual([]);
  });

  it("never emits the Neo Legacy PUSHBYTES opcode", () => {
    // 0x0C is PUSHDATA1 in N3 — the legacy decoder would mislabel this as
    // PUSHBYTES12 and consume 12 literal bytes.
    const tokens = disassembleScript("0c0401020304");
    expect(tokens.join(" ")).not.toMatch(/PUSHBYTES/);
  });

  it("decodes PUSHDATA1 as a length-prefixed data push", () => {
    // 0C 04 01020304 → PUSHDATA1 with 4 bytes of data.
    expect(disassembleScript("0c0401020304")).toEqual(["PUSHDATA1 01020304"]);
  });

  it("decodes PUSHDATA2 and PUSHDATA4 length prefixes", () => {
    // 0D 0200 0102 → PUSHDATA2, length 2 (little-endian), data 0102.
    expect(disassembleScript("0d02000102")).toEqual(["PUSHDATA2 0102"]);
    // 0E 03000000 010203 → PUSHDATA4, length 3 (little-endian), data 010203.
    expect(disassembleScript("0e03000000010203")).toEqual(["PUSHDATA4 010203"]);
  });

  it("decodes fixed-width PUSHINT operands to signed decimal with the raw hex kept", () => {
    // 00 7f → PUSHINT8 0x7f (127), the largest positive signed byte.
    expect(disassembleScript("007f")).toEqual(["PUSHINT8 127 (0x7f)"]);
    // 01 0001 → PUSHINT16 little-endian 0x0100 = 256.
    expect(disassembleScript("010001")).toEqual(["PUSHINT16 256 (0x0001)"]);
    // 00 ff → PUSHINT8 0xff is -1 in two's complement (operands are signed).
    expect(disassembleScript("00ff")).toEqual(["PUSHINT8 -1 (0xff)"]);
  });

  it("decodes constant pushes with no operand", () => {
    // 10 PUSH0, 11 PUSH1, 20 PUSH16, 0F PUSHM1, 0B PUSHNULL.
    expect(disassembleScript("101120 0f0b".replace(/\s/g, ""))).toEqual([
      "PUSH0",
      "PUSH1",
      "PUSH16",
      "PUSHM1",
      "PUSHNULL",
    ]);
  });

  it("frames a SYSCALL operand and resolves a known interop hash to its name", () => {
    // 41 <4-byte interop hash> 40(RET). 0x627d5b52 is System.Contract.Call.
    const tokens = disassembleScript("41627d5b5240");
    expect(tokens).toEqual(["SYSCALL System.Contract.Call (0x627d5b52)", "RET"]);
  });

  it("decodes a realistic data-then-syscall contract call (unknown hash kept raw)", () => {
    // PUSH0, PUSHDATA1 "hi" (0x6869), SYSCALL <unknown>, RET.
    const tokens = disassembleScript("100c026869" + "41" + "00112233" + "40");
    expect(tokens).toEqual([
      "PUSH0",
      "PUSHDATA1 6869",
      "SYSCALL 0x00112233",
      "RET",
    ]);
  });

  it("frames short and long jump operands", () => {
    // 22 03 (JMP +3), 23 04000000 (JMP_L), 40 (RET).
    expect(disassembleScript("2203" + "2304000000" + "40")).toEqual([
      "JMP 03",
      "JMP_L 04000000",
      "RET",
    ]);
  });

  it("rejects truncated variable and fixed-width operands instead of inventing output", () => {
    expect(disassembleScript("0c040102")).toEqual([]); // PUSHDATA1 claims 4 bytes, carries 2
    expect(disassembleScript("0d01")).toEqual([]); // incomplete PUSHDATA2 length prefix
    expect(disassembleScript("0100")).toEqual([]); // PUSHINT16 missing one operand byte
    expect(disassembleScript("41aabb")).toEqual([]); // SYSCALL missing two bytes
    expect(disassembleScript("23aabb")).toEqual([]); // JMP_L missing two bytes
  });
});
