import { encodeBase64Url } from "jsr:@std/encoding/base64url";

export async function signJwt(payload: object, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const header = { alg: "HS256", typ: "JWT" };
    
    const encodedHeader = encodeBase64Url(encoder.encode(JSON.stringify(header)));
    const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
    const data = `${encodedHeader}.${encodedPayload}`;

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    const encodedSignature = encodeBase64Url(new Uint8Array(signature));

    return `${data}.${encodedSignature}`;
}
