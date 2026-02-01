import {
  aexists,
  ahash,
  aoutput,
  anumber,
  isBytes,
} from "@noble/hashes/utils.js";

export function number(n: number): void {
  anumber(n);
}

export function bool(value: boolean): void {
  if (typeof value !== "boolean") {
    throw new Error(`boolean expected, not ${typeof value}`);
  }
}

export function bytes(value: Uint8Array, ...lengths: number[]): void {
  if (!isBytes(value)) {
    throw new Error("Uint8Array expected");
  }
  if (lengths.length > 0 && !lengths.includes(value.length)) {
    throw new Error(
      `Uint8Array expected of length ${lengths}, not of length=${value.length}`,
    );
  }
}

export function hash(value: unknown): void {
  ahash(value as any);
}

export function exists(
  instance: { destroyed?: boolean; finished?: boolean },
  checkFinished = true,
): void {
  aexists(instance as any, checkFinished);
}

export function output(out: Uint8Array, instance: { outputLen: number }): void {
  aoutput(out, instance as any);
}

const assert = { number, bool, bytes, hash, exists, output };

export { isBytes };
export default assert;
