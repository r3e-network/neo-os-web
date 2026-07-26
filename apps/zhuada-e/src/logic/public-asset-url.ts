export function publicAssetUrl(relativePath: string): string {
  if (!import.meta.env.PROD) return relativePath;
  return new URL(relativePath, document.baseURI).href;
}
