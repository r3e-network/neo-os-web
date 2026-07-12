#!/usr/bin/env node
/** Deterministic, original PCM sound pack for the production game. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 22050;
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(appDir, "public", "audio");

function rngFor(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buffer(seconds) {
  return new Float32Array(Math.ceil(seconds * RATE));
}

function addTone(data, start, duration, frequency, gain, type = "sine", glide = 0) {
  const from = Math.floor(start * RATE);
  const count = Math.floor(duration * RATE);
  let phase = 0;
  for (let i = 0; i < count && from + i < data.length; i += 1) {
    const t = i / Math.max(1, count - 1);
    const attack = Math.min(1, t / 0.08);
    const release = Math.pow(1 - t, 1.8);
    const f = frequency + glide * t;
    phase += (Math.PI * 2 * f) / RATE;
    const wave = type === "triangle"
      ? (2 / Math.PI) * Math.asin(Math.sin(phase))
      : type === "square"
        ? Math.sign(Math.sin(phase))
        : Math.sin(phase);
    data[from + i] += wave * gain * attack * release;
  }
}

function addNoise(data, start, duration, gain, seed, dark = 0.72) {
  const random = rngFor(seed);
  const from = Math.floor(start * RATE);
  const count = Math.floor(duration * RATE);
  let filtered = 0;
  for (let i = 0; i < count && from + i < data.length; i += 1) {
    const t = i / Math.max(1, count - 1);
    filtered = filtered * dark + (random() * 2 - 1) * (1 - dark);
    data[from + i] += filtered * gain * Math.pow(1 - t, 2.2);
  }
}

function normalize(data, peak = 0.86) {
  let max = 0;
  for (const sample of data) max = Math.max(max, Math.abs(sample));
  const scale = max > 0 ? peak / max : 1;
  for (let i = 0; i < data.length; i += 1) data[i] = Math.tanh(data[i] * scale);
  return data;
}

function addBed(data, gain, seed, smoothing = 0.985) {
  const random = rngFor(seed);
  let filtered = 0;
  for (let i = 0; i < data.length; i += 1) {
    filtered = filtered * smoothing + (random() * 2 - 1) * (1 - smoothing);
    const edge = Math.min(1, i / (RATE * 0.25), (data.length - i - 1) / (RATE * 0.25));
    data[i] += filtered * gain * Math.max(0, edge);
  }
}

function ambience(name) {
  const data = buffer(6);
  if (name === "garden") {
    addBed(data, 0.5, 801, 0.992);
    [0.7, 2.25, 4.4].forEach((start, i) => {
      addTone(data, start, 0.22, 1180 + i * 95, 0.09, "sine", 480);
      addTone(data, start + 0.14, 0.18, 1660 + i * 80, 0.07, "sine", -260);
    });
  } else if (name === "kitchen") {
    addBed(data, 0.42, 802, 0.987);
    [0.9, 2.85, 4.8].forEach((start, i) => {
      addTone(data, start, 0.16, 720 + i * 65, 0.065, "triangle", -170);
      addNoise(data, start, 0.12, 0.08, 820 + i, 0.82);
    });
  } else {
    addBed(data, 0.34, 803, 0.994);
    [0.55, 1.95, 3.4, 5.0].forEach((start, i) => {
      addTone(data, start, 0.72, [440, 523.25, 659.25, 587.33][i], 0.065, "sine");
      addTone(data, start + 0.04, 0.5, [880, 1046.5, 1318.5, 1174.7][i], 0.025, "sine");
    });
  }
  return normalize(data, 0.24);
}

function cue(name) {
  let data;
  switch (name) {
    case "land":
      data = buffer(0.18); addNoise(data, 0, 0.13, 0.6, 11, 0.86); addTone(data, 0, 0.16, 96, 0.52, "sine", -32); break;
    case "pick":
      data = buffer(0.19); addTone(data, 0, 0.12, 510, 0.52, "triangle", 210); addTone(data, 0.04, 0.13, 820, 0.3); break;
    case "match":
      data = buffer(0.46); [523.25, 659.25, 783.99].forEach((f, i) => addTone(data, i * 0.065, 0.25, f, 0.34, "sine")); addNoise(data, 0.1, 0.2, 0.08, 21, 0.2); break;
    case "combo":
      data = buffer(0.58); [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => addTone(data, i * 0.055, 0.24, f, 0.3, "triangle")); break;
    case "win":
      data = buffer(1.08); [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => addTone(data, i * 0.12, 0.46, f, 0.26, "triangle")); addNoise(data, 0.48, 0.4, 0.07, 31, 0.25); break;
    case "fail":
      data = buffer(0.78); addTone(data, 0, 0.42, 390, 0.38, "triangle", -110); addTone(data, 0.19, 0.5, 255, 0.36, "triangle", -70); break;
    case "powerup":
      data = buffer(0.5); [660, 990, 1320].forEach((f, i) => addTone(data, i * 0.075, 0.24, f, 0.28)); break;
    case "shuffle":
      data = buffer(0.5); for (let i = 0; i < 6; i += 1) { addNoise(data, i * 0.055, 0.09, 0.22, 100 + i, 0.55); addTone(data, i * 0.055, 0.08, 360 + i * 80, 0.12, "triangle"); } break;
    case "click":
      data = buffer(0.09); addTone(data, 0, 0.07, 1150, 0.32, "triangle", -180); break;
    case "tick":
      data = buffer(0.13); addNoise(data, 0, 0.07, 0.36, 55, 0.8); addTone(data, 0, 0.11, 520, 0.26); break;
    case "unlock":
      data = buffer(1.28); [523.25, 659.25, 880, 1046.5, 1318.5].forEach((f, i) => addTone(data, i * 0.1, 0.52, f, 0.25, "triangle")); addTone(data, 0.55, 0.62, 1760, 0.14); break;
    case "shake":
      data = buffer(0.58); for (let i = 0; i < 6; i += 1) addNoise(data, i * 0.065, 0.11, 0.34 - i * 0.025, 70 + i, 0.7); addTone(data, 0, 0.28, 185, 0.28, "triangle", -55); break;
    default:
      throw new Error(`Unknown cue: ${name}`);
  }
  return normalize(data);
}

function wav(data) {
  const out = Buffer.alloc(44 + data.length * 2);
  out.write("RIFF", 0); out.writeUInt32LE(36 + data.length * 2, 4); out.write("WAVE", 8);
  out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22); out.writeUInt32LE(RATE, 24); out.writeUInt32LE(RATE * 2, 28);
  out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write("data", 36);
  out.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    out.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return out;
}

await fs.mkdir(outDir, { recursive: true });
const names = ["land", "pick", "match", "combo", "win", "fail", "powerup", "shuffle", "click", "tick", "unlock", "shake"];
for (const name of names) {
  const file = path.join(outDir, `${name}.wav`);
  await fs.writeFile(file, wav(cue(name)));
  const stat = await fs.stat(file);
  console.log(`${name}.wav\t${stat.size} bytes`);
}

for (const name of ["garden", "kitchen", "night"]) {
  const file = path.join(outDir, `ambient-${name}.wav`);
  await fs.writeFile(file, wav(ambience(name)));
  const stat = await fs.stat(file);
  console.log(`ambient-${name}.wav\t${stat.size} bytes`);
}
