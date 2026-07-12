#!/usr/bin/env node

const value = (process.env.VITE_BUILD_SHA ?? "").trim();
const placeholderValues = new Set([
  "",
  "<git-sha>",
  "local-unbound",
  "dev",
  "test",
]);

function reject(message) {
  console.error(`Device QA env rejected: ${message}`);
  process.exit(1);
}

if (placeholderValues.has(value.toLowerCase())) {
  reject("VITE_BUILD_SHA must be set to the real git commit SHA before building a physical-device QA bundle.");
}

if (!/^[a-f0-9]{7,40}$/i.test(value)) {
  reject("VITE_BUILD_SHA must be a 7-40 character hexadecimal git commit SHA.");
}

console.log(`Device QA env gate passed: VITE_BUILD_SHA=${value.slice(0, 12)}`);
