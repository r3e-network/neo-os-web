function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasPlatformBinding(manifestSource, key) {
  const marker = manifestSource.indexOf("platformBindings");
  if (marker < 0) return false;
  const escapedKey = escapeRegExp(String(key).trim());
  return new RegExp(`\\b${escapedKey}\\s*:\\s*(?:["'\`][^"'\`]+["'\`]|\\{)`).test(
    manifestSource.slice(marker),
  );
}
