export function getAdminAuthHeaders(): HeadersInit {
  const envKey = process.env.NEXT_PUBLIC_ADMIN_CONSOLE_API_KEY || process.env.NEXT_PUBLIC_ADMIN_API_KEY || "";
  if (envKey) {
    return { "X-Admin-Key": envKey };
  }

  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem("admin_api_key") || "";
    return stored ? { "X-Admin-Key": stored } : {};
  } catch {
    return {};
  }
}
