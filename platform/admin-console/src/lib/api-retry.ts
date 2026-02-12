// =============================================================================
// Shared API Retry Utilities
// Reusable retry logic for Edge Function calls
// =============================================================================

export type EdgeFunctionRequest = {
  app_id: string;
  action: "approve" | "reject" | "disable";
  reason?: string;
};

export function isRetryable(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return (
      error.message.includes("ECONNRESET") ||
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("ECONNREFUSED")
    );
  }
  return false;
}

export async function callWithRetry(
  url: string,
  body: EdgeFunctionRequest,
  serviceRoleKey: string,
  retries = 1
): Promise<Response> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok && retries > 0 && isRetryable(response.status)) {
      console.warn(`Edge function returned ${response.status}, retrying... (${retries} retries left)`);
      return callWithRetry(url, body, serviceRoleKey, retries - 1);
    }

    return response;
  } catch (error) {
    if (retries > 0 && isNetworkError(error)) {
      console.warn(`Network error, retrying... (${retries} retries left)`, error);
      return callWithRetry(url, body, serviceRoleKey, retries - 1);
    }
    throw error;
  }
}
