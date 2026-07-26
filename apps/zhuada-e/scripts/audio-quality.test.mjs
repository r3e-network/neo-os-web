import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const audioDir = path.join(root, "public", "audio");

const cues = {
  land: 0.18,
  pick: 0.19,
  match: 0.46,
  combo: 0.58,
  comboBreak: 0.35,
  traySlot: 0.12,
  win: 1.28,
  fail: 0.78,
  powerup: 0.5,
  shuffle: 0.5,
  click: 0.09,
  tick: 0.13,
  unlock: 1.28,
  shake: 0.58,
};

const ambiences = ["ambient-garden", "ambient-kitchen", "ambient-night"];

function readPcm(name) {
  const file = path.join(audioDir, `${name}.wav`);
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF", `${name}: missing RIFF header`);
  assert.equal(bytes.toString("ascii", 8, 12), "WAVE", `${name}: missing WAVE header`);
  assert.equal(bytes.readUInt16LE(20), 1, `${name}: expected PCM format`);
  assert.equal(bytes.readUInt16LE(22), 2, `${name}: expected stereo`);
  assert.equal(bytes.readUInt32LE(24), 44100, `${name}: expected 44.1kHz sample rate`);
  assert.equal(bytes.readUInt16LE(34), 16, `${name}: expected 16-bit samples`);
  const dataBytes = bytes.readUInt32LE(40);
  const frameCount = dataBytes / 4; // 2 channels * 2 bytes per sample
  const samples = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i += 1) {
    const l = bytes.readInt16LE(44 + i * 4) / 32768;
    const r = bytes.readInt16LE(44 + i * 4 + 2) / 32768;
    samples[i] = (l + r) / 2; // mono mixdown for analysis
  }
  return samples;
}

function analyze(samples) {
  let sumSquares = 0;
  let peak = 0;
  let clipped = 0;
  let zeroCrossings = 0;
  let previous = 0;
  for (const sample of samples) {
    const abs = Math.abs(sample);
    sumSquares += sample * sample;
    peak = Math.max(peak, abs);
    if (abs >= 0.98) clipped += 1;
    const sign = Math.sign(sample);
    if (sign !== 0 && previous !== 0 && sign !== previous) zeroCrossings += 1;
    if (sign !== 0) previous = sign;
  }
  const duration = samples.length / 44100;
  return {
    duration,
    rms: Math.sqrt(sumSquares / samples.length),
    peak,
    clippedRatio: clipped / samples.length,
    zeroCrossingsPerSecond: zeroCrossings / duration,
  };
}

function fingerprint(samples) {
  const buckets = 32;
  const stride = Math.max(1, Math.floor(samples.length / buckets));
  const parts = [];
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    let signedEnergy = 0;
    let absoluteEnergy = 0;
    for (let i = bucket * stride; i < Math.min(samples.length, (bucket + 1) * stride); i += 1) {
      signedEnergy += samples[i];
      absoluteEnergy += Math.abs(samples[i]);
    }
    parts.push(`${Math.round(signedEnergy * 1000)}:${Math.round(absoluteEnergy * 1000)}`);
  }
  return parts.join("|");
}

describe("generated audio quality gate", () => {
  it("keeps all gameplay SFX audible, unclipped, and duration-distinct", () => {
    const fingerprints = new Set();

    for (const [cue, expectedDuration] of Object.entries(cues)) {
      const samples = readPcm(cue);
      const stats = analyze(samples);

      assert.ok(Math.abs(stats.duration - expectedDuration) < 0.012,
        `${cue}: duration drifted from ${expectedDuration}s to ${stats.duration.toFixed(3)}s`);
      assert.ok(stats.rms >= 0.08,
        `${cue}: expected audible RMS, got ${stats.rms.toFixed(4)}`);
      assert.ok(stats.peak >= 0.24 && stats.peak <= 0.9,
        `${cue}: expected mastered peak below clipping, got ${stats.peak.toFixed(3)}`);
      assert.ok(stats.clippedRatio <= 0.001,
        `${cue}: clipping ratio too high (${(stats.clippedRatio * 100).toFixed(2)}%)`);
      assert.ok(stats.zeroCrossingsPerSecond >= 120,
        `${cue}: waveform is too flat or low-information`);
      fingerprints.add(fingerprint(samples));
    }

    assert.equal(fingerprints.size, Object.keys(cues).length,
      "all gameplay cues must have unique waveform fingerprints, not reused placeholder audio");
  });

  it("keeps all three ambience loops present, subtle, and unique", () => {
    const fingerprints = new Set();

    for (const ambience of ambiences) {
      const samples = readPcm(ambience);
      const stats = analyze(samples);

      assert.ok(Math.abs(stats.duration - 6) < 0.012,
        `${ambience}: expected a six-second loop, got ${stats.duration.toFixed(3)}s`);
      assert.ok(stats.rms >= 0.02 && stats.rms <= 0.08,
        `${ambience}: ambience should be present but not overpowering, RMS ${stats.rms.toFixed(4)}`);
      assert.ok(stats.peak <= 0.35,
        `${ambience}: ambience peak too loud (${stats.peak.toFixed(3)})`);
      assert.ok(stats.clippedRatio === 0,
        `${ambience}: ambience must not clip`);
      fingerprints.add(fingerprint(samples));
    }

    assert.equal(fingerprints.size, ambiences.length,
      "theme ambience loops must be unique per theme");
  });
});
