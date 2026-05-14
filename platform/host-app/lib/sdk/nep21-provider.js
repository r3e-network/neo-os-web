let cachedProvider = null;
let cachedWindow = null;
function getTargetWindow(targetWindow) {
    if (targetWindow)
        return targetWindow;
    if (typeof window === "undefined")
        return null;
    return window;
}
function hasNep21Metadata(provider) {
    const version = String(provider.dapiVersion ?? "").trim();
    const compatible = Array.isArray(provider.compatibility)
        ? provider.compatibility.some((entry) => String(entry).toUpperCase() === "NEP-21")
        : false;
    return compatible || version === "1.0" || version.startsWith("1.0.");
}
function hasUsableDapiCapability(provider) {
    return (typeof provider.invoke === "function" ||
        typeof provider.call === "function" ||
        typeof provider.send === "function" ||
        typeof provider.signMessage === "function" ||
        typeof provider.authenticate === "function" ||
        typeof provider.getBalance === "function");
}
export function isNep21Provider(value) {
    if (!value || typeof value !== "object")
        return false;
    const provider = value;
    return (typeof provider.getAccounts === "function" &&
        (hasNep21Metadata(provider) || hasUsableDapiCapability(provider)));
}
function registryCandidates(registry) {
    if (!registry || typeof registry !== "object")
        return [];
    return Object.entries(registry).map(([key, provider]) => ({
        key,
        provider,
    }));
}
function providerCandidates(win) {
    return [
        { provider: win.NEP21Provider },
        ...registryCandidates(win.NEP21Providers),
        { provider: win.OneGateDapiProvider },
        { provider: win.Neo?.DapiProvider },
        { provider: win.neoDapiProvider },
        { provider: win.neoDapi },
    ];
}
function providerMatchesPreference(win, provider, preference, key) {
    if (preference === "any")
        return true;
    const name = String(provider.name ?? key ?? "").toLowerCase();
    return win.OneGateDapiProvider === provider || name.includes("onegate");
}
function findProviderCandidate(win, preference) {
    const candidates = providerCandidates(win);
    const match = candidates.find((candidate) => isNep21Provider(candidate.provider) &&
        providerMatchesPreference(win, candidate.provider, preference, candidate.key));
    return isNep21Provider(match?.provider) ? match.provider : null;
}
function providerStillVisible(win, provider, preference) {
    return providerCandidates(win).some((candidate) => candidate.provider === provider &&
        providerMatchesPreference(win, provider, preference, candidate.key));
}
export function rememberNep21Provider(provider, targetWindow) {
    if (!isNep21Provider(provider))
        return null;
    const win = getTargetWindow(targetWindow);
    if (!win)
        return provider;
    cachedProvider = provider;
    cachedWindow = win;
    win.NEP21Provider = provider;
    const registry = win.NEP21Providers && typeof win.NEP21Providers === "object"
        ? { ...win.NEP21Providers }
        : {};
    const name = String(provider.name ?? "").trim();
    if (name)
        registry[name] = provider;
    win.NEP21Providers = registry;
    return provider;
}
export function readImmediateNep21Provider(options = {}) {
    const preference = options.preference ?? "any";
    const win = getTargetWindow(options.targetWindow);
    if (!win)
        return null;
    if (cachedProvider &&
        cachedWindow === win &&
        providerStillVisible(win, cachedProvider, preference)) {
        return cachedProvider;
    }
    const provider = findProviderCandidate(win, preference);
    return provider ? rememberNep21Provider(provider, win) : null;
}
export function extractNep21ProviderFromReadyEvent(event) {
    const detail = event.detail;
    if (isNep21Provider(detail))
        return detail;
    if (detail && typeof detail === "object") {
        return detail.provider;
    }
    return null;
}
export function requestNep21Provider(targetWindow) {
    const win = getTargetWindow(targetWindow);
    if (!win || typeof win.dispatchEvent !== "function")
        return;
    win.dispatchEvent(new CustomEvent("Neo.DapiProvider.request", {
        detail: { version: "1.0" },
    }));
}
export function waitForNep21Provider(options = {}) {
    const timeoutMs = options.timeoutMs ?? 3000;
    const preference = options.preference ?? "any";
    const win = getTargetWindow(options.targetWindow);
    if (!win)
        return Promise.reject(new Error("NEP-21 dAPI provider not detected."));
    const immediate = readImmediateNep21Provider({ preference, targetWindow: win });
    if (immediate)
        return Promise.resolve(immediate);
    return new Promise((resolve, reject) => {
        let settled = false;
        let timeout;
        const finish = (provider, error) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timeout);
            win.removeEventListener("Neo.DapiProvider.ready", onReady);
            if (provider) {
                resolve(provider);
            }
            else {
                reject(error ?? new Error("NEP-21 dAPI provider not detected."));
            }
        };
        const onReady = (event) => {
            const provider = rememberNep21Provider(extractNep21ProviderFromReadyEvent(event), win);
            if (!provider)
                return;
            if (!providerMatchesPreference(win, provider, preference))
                return;
            finish(provider);
        };
        timeout = setTimeout(() => finish(null, new Error("NEP-21 dAPI provider not detected.")), timeoutMs);
        win.addEventListener("Neo.DapiProvider.ready", onReady);
        if (options.request ?? true)
            requestNep21Provider(win);
    });
}
export function resetNep21ProviderCacheForTests() {
    cachedProvider = null;
    cachedWindow = null;
}
