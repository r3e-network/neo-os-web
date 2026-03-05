export function readQueryParam(key: string): string | null {
    if (typeof window === "undefined") return null;
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get(key);
}

export function buildUrlWithParams(
    baseUrl: string,
    params: Record<string, string | number | boolean | null | undefined>
): string {
    const url = new URL(baseUrl, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}
