import { describe, expect, it } from "vitest";
import { ethers } from "ethers";

import {
  encodeParams,
  decodeUintArray,
  decodeMessageStruct,
  utf8ToBytes,
  bytesToUtf8,
} from "../utils/evm-chain";

// These hand-rolled ABI helpers (dependency-free in the bundle) are validated
// here against ethers' AbiCoder so the Neo Message lane encodes/decodes exactly
// like the on-chain MiniAppMessageEVM contract. Inputs to ethers are passed as
// hex strings (not Uint8Array) to avoid the jsdom cross-realm BytesLike issue.
const coder = ethers.AbiCoder.defaultAbiCoder();
const toHex = (text: string) => "0x" + Buffer.from(text, "utf8").toString("hex");

describe("evm-chain ABI codec", () => {
  it("encodeParams matches ethers for sendMessage(address,bytes,uint64)", () => {
    const recipient = "0x622ae03BDB6d7E2A29BE853c75d625bB25c0139C";
    const envelopeText = "eyJ2IjoyfQ=="; // a base64-ish envelope string
    const unlockTime = 1780880675;

    const mine = encodeParams([
      { t: "address", v: recipient },
      { t: "bytes", v: utf8ToBytes(envelopeText) },
      { t: "uint", v: unlockTime },
    ]);
    const reference = coder
      .encode(["address", "bytes", "uint64"], [recipient, toHex(envelopeText), unlockTime])
      .replace(/^0x/, "");
    expect(mine).toBe(reference);
  });

  it("encodeParams handles empty bytes", () => {
    const mine = encodeParams([{ t: "bytes", v: new Uint8Array(0) }]);
    const reference = coder.encode(["bytes"], ["0x"]).replace(/^0x/, "");
    expect(mine).toBe(reference);
  });

  it("decodeUintArray matches ethers for uint256[] (inboxOf)", () => {
    const ids = [1n, 4n, 42n];
    const encoded = coder.encode(["uint256[]"], [ids]);
    expect(decodeUintArray(encoded)).toEqual(ids);
    expect(decodeUintArray(coder.encode(["uint256[]"], [[]]))).toEqual([]);
  });

  const tupleType =
    "tuple(address sender,address recipient,bytes envelope,uint64 unlockTime,uint64 sentAt,bool revealed,string plaintext)";

  it("decodeMessageStruct matches ethers for getMessage tuple", () => {
    const value = {
      sender: "0x1111111111111111111111111111111111111111",
      recipient: "0x622ae03BDB6d7E2A29BE853c75d625bB25c0139C",
      envelope: toHex("envelope-bytes"),
      unlockTime: 1780880675,
      sentAt: 1780880000,
      revealed: true,
      plaintext: "TIME-LOCKED: hello world",
    };
    const decoded = decodeMessageStruct(coder.encode([tupleType], [value]));
    expect(decoded.sender.toLowerCase()).toBe(value.sender.toLowerCase());
    expect(decoded.recipient.toLowerCase()).toBe(value.recipient.toLowerCase());
    expect(decoded.unlockTime).toBe(value.unlockTime);
    expect(decoded.sentAt).toBe(value.sentAt);
    expect(decoded.revealed).toBe(true);
    expect(decoded.plaintext).toBe(value.plaintext);
    expect(bytesToUtf8(decoded.envelope)).toBe("envelope-bytes");
  });

  it("decodeMessageStruct handles an unrevealed message (empty plaintext)", () => {
    const value = {
      sender: "0x1111111111111111111111111111111111111111",
      recipient: "0x0000000000000000000000000000000000000000",
      envelope: toHex("x"),
      unlockTime: 0,
      sentAt: 1780880000,
      revealed: false,
      plaintext: "",
    };
    const decoded = decodeMessageStruct(coder.encode([tupleType], [value]));
    expect(decoded.revealed).toBe(false);
    expect(decoded.plaintext).toBe("");
    expect(decoded.unlockTime).toBe(0);
  });
});
