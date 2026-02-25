function readRuntimeAdminKey(): string {
  if (typeof window === "undefined") return "";

  try {
    const fromMeta = document.querySelector('meta[name="admin-api-key"]')?.getAttribute("content") || "";
    return fromMeta.trim();
  } catch {
    return "";
  }
}

export function getAdminAuthHeaders(): HeadersInit {
  const envKey = String(process.env.NEXT_PUBLIC_ADMIN_CONSOLE_API_KEY || process.env.NEXT_PUBLIC_ADMIN_API_KEY || "").trim();
  if (envKey) {
    return { "X-Admin-Key": envKey };
  }

  const runtimeKey = readRuntimeAdminKey();
  return runtimeKey ? { "X-Admin-Key": runtimeKey } : {};
}
