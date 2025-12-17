import { error } from "./response.ts";

export async function postJSON(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<unknown | Response> {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  if (!resp.ok) {
    return error(resp.status, text || `upstream error (${resp.status})`, "UPSTREAM_ERROR");
  }

  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return error(502, "invalid upstream JSON", "UPSTREAM_INVALID_JSON");
  }
}

