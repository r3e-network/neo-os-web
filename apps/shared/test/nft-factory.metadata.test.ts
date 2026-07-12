import { describe, expect, it, vi } from "vitest";

import { verifyNftMetadataOrigin } from "../../nft-factory/src/nft-factory-metadata";

function jsonResponse(
  body: unknown,
  init: { status?: number; contentType?: string; contentLength?: string } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": init.contentType ?? "application/json; charset=utf-8",
      ...(init.contentLength
        ? { "content-length": init.contentLength }
        : {}),
    },
  });
}

describe("NFT Factory metadata-origin verification", () => {
  it("reads token #1 and accepts a minimal NFT JSON document", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        name: "Sunlit Edition #1",
        image: "ipfs://bafybeigallery/1.webp",
      }),
    );

    const result = await verifyNftMetadataOrigin(
      "https://metadata.example.com/sunlit/",
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://metadata.example.com/sunlit/1",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      }),
    );
    expect(result).toMatchObject({
      status: "verified",
      detailKey: "metadataVerified",
      name: "Sunlit Edition #1",
      image: "ipfs://bafybeigallery/1.webp",
      sampleUrl: "https://metadata.example.com/sunlit/1",
    });
  });

  it("rejects non-HTTPS and non-directory origins without sending a request", async () => {
    const fetcher = vi.fn();

    await expect(
      verifyNftMetadataOrigin("http://metadata.example.com/drop/", fetcher),
    ).resolves.toMatchObject({
      status: "invalid",
      detailKey: "metadataBaseUriInvalid",
    });
    await expect(
      verifyNftMetadataOrigin("https://metadata.example.com/drop", fetcher),
    ).resolves.toMatchObject({
      status: "invalid",
      detailKey: "metadataBaseUriInvalid",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ["non-JSON content", new Response("hello", { headers: { "content-type": "text/plain" } })],
    ["invalid JSON", new Response("{", { headers: { "content-type": "application/json" } })],
    ["missing image", jsonResponse({ name: "No image" })],
    ["unsafe image", jsonResponse({ name: "Bad image", image: "http://cdn.example.com/1.png" })],
    [
      "declared oversize body",
      jsonResponse(
        { name: "Huge", image: "https://cdn.example.com/1.png" },
        { contentLength: String(256 * 1024 + 1) },
      ),
    ],
  ])("marks %s as invalid NFT metadata", async (_label, response) => {
    const result = await verifyNftMetadataOrigin(
      "https://metadata.example.com/drop/",
      vi.fn(async () => response),
    );
    expect(result).toMatchObject({
      status: "invalid",
      detailKey: "metadataSampleInvalid",
    });
  });

  it("keeps an unreachable sample distinct from malformed metadata", async () => {
    const result = await verifyNftMetadataOrigin(
      "https://metadata.example.com/drop/",
      vi.fn(async () => jsonResponse({}, { status: 404 })),
    );
    expect(result).toMatchObject({
      status: "unavailable",
      detailKey: "metadataSampleUnavailable",
    });
  });
});
