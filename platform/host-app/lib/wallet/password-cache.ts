/**
 * Password Cache Service
 * Securely caches session password for 30 minutes to improve UX
 * Uses sessionStorage to ensure data is cleared when tab is closed
 */

const CACHE_KEY = "neo_wallet_session_auth";
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

interface CachedAuth {
    value: string; // Base64 encoded password for basic obfuscation
    expiry: number;
}

export const PasswordCache = {
    /**
     * Save password to session storage with expiration
     */
    set(password: string) {
        if (typeof window === "undefined") return;

        const data: CachedAuth = {
            value: btoa(password), // Simple obfuscation
            expiry: Date.now() + SESSION_DURATION,
        };

        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn("Failed to cache password", e);
        }
    },

    /**
     * Retrieve valid cached password
     */
    get(): string | null {
        if (typeof window === "undefined") return null;

        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;

            const data: CachedAuth = JSON.parse(raw);

            // Check for expiration
            if (Date.now() > data.expiry) {
                sessionStorage.removeItem(CACHE_KEY);
                return null;
            }

            return atob(data.value);
        } catch (e) {
            console.warn("Failed to retrieve cached password", e);
            sessionStorage.removeItem(CACHE_KEY);
            return null;
        }
    },

    /**
     * Clear cached password
     */
    clear() {
        if (typeof window === "undefined") return;
        sessionStorage.removeItem(CACHE_KEY);
    },
};
