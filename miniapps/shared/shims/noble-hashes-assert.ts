export function isBytes(value: unknown): value is Uint8Array {
  return (
    value instanceof Uint8Array ||
    (ArrayBuffer.isView(value) &&
      (value as Uint8Array).BYTES_PER_ELEMENT === 1 &&
      (value as Uint8Array).constructor.prototype === Uint8Array.prototype)
  );
}

function anumber(n: number, title = ""): void {
  if (!Number.isSafeInteger(n) || n < 0) {
    const prefix = title ? `"${title}" ` : "";
    throw new Error(`${prefix}expected integer >= 0, got ${n}`);
  }
}

function ahash(value: unknown): void {
  if (typeof value !== "function" || typeof (value as { create?: unknown }).create !== "function") {
    throw new Error("Hash should be wrapped by utils.createHasher");
  }
  const hash = value as unknown as { outputLen: number; blockLen: number };
  anumber(hash.outputLen);
  anumber(hash.blockLen);
}

function aexists(instance: { destroyed?: boolean; finished?: boolean }, checkFinished = true): void {
  if (instance.destroyed) {
    throw new Error("Hash instance has been destroyed");
  }
  if (checkFinished && instance.finished) {
    throw new Error("Hash#digest() has already been called");
  }
}

function aoutput(out: Uint8Array, instance: { outputLen: number }): void {
  if (!isBytes(out)) {
    throw new Error('"digestInto() output" expected Uint8Array');
  }
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error(`"digestInto() output" expected to be of length >=${min}`);
  }
}

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
    throw new Error(`Uint8Array expected of length ${lengths}, not of length=${value.length}`);
  }
}

export function hash(value: unknown): void {
  ahash(value);
}

export function exists(instance: { destroyed?: boolean; finished?: boolean }, checkFinished = true): void {
  aexists(instance, checkFinished);
}

export function output(out: Uint8Array, instance: { outputLen: number }): void {
  aoutput(out, instance);
}

const assert = { number, bool, bytes, hash, exists, output };

export default assert;
