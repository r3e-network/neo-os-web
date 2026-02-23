export function downloadTextFile(content: string, filename: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadJsonFile(value: unknown, filename: string) {
  downloadTextFile(JSON.stringify(value, null, 2), filename, "application/json");
}

export function triggerDownloadHref(href: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.click();
}
