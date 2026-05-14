export type NeoDapiEventName = "accountchanged" | "accountschanged" | "networkchanged";
export type NeoDapiAccount = {
    hash: string;
    address?: string;
    label?: string;
    isDefault?: boolean;
};
export type NeoDapiInvocation<TArg = {
    type: string;
    value: unknown;
}> = {
    hash: string;
    operation: string;
    args?: TArg[];
    abortOnFail?: boolean;
};
export type NeoDapiAuthenticationResponse = {
    network?: number;
    address?: string;
    nonce?: string;
    pubkey?: string;
    signature?: string;
};
export interface NeoDapiProvider<TArg = {
    type: string;
    value: unknown;
}, TCallResult = unknown> {
    compatibility?: string[];
    dapiVersion?: string;
    extra?: unknown;
    name?: string;
    network?: number;
    supportedNetworks?: number[];
    version?: string;
    website?: string;
    on?: (event: NeoDapiEventName, listener: () => void) => void;
    removeListener?: (event: NeoDapiEventName, listener: () => void) => void;
    authenticate?: (payload: {
        action: "Authentication";
        grant_type: "Signature";
        allowed_algorithms: ["ECDSA-P256"];
        domain: string;
        networks: number[];
        nonce: string;
        timestamp: number;
    }) => Promise<NeoDapiAuthenticationResponse>;
    call?: (invocation: NeoDapiInvocation<TArg>) => Promise<TCallResult>;
    getAccounts: () => Promise<NeoDapiAccount[]>;
    getBalance?: (asset: string, account?: string) => Promise<unknown>;
    invoke?: (invocations: NeoDapiInvocation<TArg>[], signers?: Array<Record<string, unknown>>, suggestedSystemFee?: string) => Promise<unknown>;
    send?: (asset: string, from: string, to: string, amount: string, data?: TArg) => Promise<unknown>;
    signMessage?: (message: string, account?: string) => Promise<{
        signature?: string;
        data?: string;
        account?: string;
        pubkey?: string;
        publicKey?: string;
        salt?: string;
        message?: string;
    }>;
}
export type Nep21ProviderPreference = "any" | "onegate";
export type Nep21Window = Window & {
    NEP21Provider?: unknown;
    NEP21Providers?: Record<string, unknown> | unknown[];
    Neo?: {
        DapiProvider?: unknown;
    };
    OneGateDapiProvider?: unknown;
    neoDapiProvider?: unknown;
    neoDapi?: unknown;
};
export declare function isNep21Provider(value: unknown): value is NeoDapiProvider;
export declare function rememberNep21Provider(provider: unknown, targetWindow?: Window): NeoDapiProvider | null;
export declare function readImmediateNep21Provider(options?: {
    preference?: Nep21ProviderPreference;
    targetWindow?: Window;
}): NeoDapiProvider | null;
export declare function extractNep21ProviderFromReadyEvent(event: Event): unknown;
export declare function requestNep21Provider(targetWindow?: Window): void;
export declare function waitForNep21Provider(options?: {
    timeoutMs?: number;
    preference?: Nep21ProviderPreference;
    targetWindow?: Window;
    request?: boolean;
}): Promise<NeoDapiProvider>;
export declare function resetNep21ProviderCacheForTests(): void;
