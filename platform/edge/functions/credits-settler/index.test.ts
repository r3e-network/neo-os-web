import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handler } from "./index.ts";

function cronRequest(body: unknown, secret?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["X-Cron-Secret"] = secret;
  return new Request("http://localhost/credits-settler", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

Deno.test("credits-settler: rejects non-POST", async () => {
  const res = await handler(new Request("http://localhost/credits-settler", { method: "GET" }));
  assertEquals(res.status, 405);
});

Deno.test("credits-settler: fails closed when cron secret unconfigured", async () => {
  Deno.env.delete("CREDITS_CRON_SECRET");
  const res = await handler(cronRequest({ network: "testnet" }, "anything"));
  assertEquals(res.status, 503);
});

Deno.test("credits-settler: rejects wrong cron secret", async () => {
  try {
    Deno.env.set("CREDITS_CRON_SECRET", "settler-test-secret");
    const res = await handler(cronRequest({ network: "testnet" }, "wrong"));
    assertEquals(res.status, 401);
  } finally {
    Deno.env.delete("CREDITS_CRON_SECRET");
  }
});

Deno.test("credits-settler: validates network", async () => {
  try {
    Deno.env.set("CREDITS_CRON_SECRET", "settler-test-secret");
    const res = await handler(cronRequest({ network: "" }, "settler-test-secret"));
    assertEquals(res.status, 400);
  } finally {
    Deno.env.delete("CREDITS_CRON_SECRET");
  }
});

Deno.test("credits-settler: 503 when contract hash unconfigured", async () => {
  try {
    Deno.env.set("CREDITS_CRON_SECRET", "settler-test-secret");
    Deno.env.delete("CONTRACT_MINIAPP_CREDITS_HASH");
    Deno.env.delete("CONTRACT_MINIAPP_CREDITS_HASH_MAINNET");
    const res = await handler(cronRequest({ network: "mainnet" }, "settler-test-secret"));
    assertEquals(res.status, 503);
    const body = await res.json();
    assertEquals(body?.error?.code, "NOT_CONFIGURED");
  } finally {
    Deno.env.delete("CREDITS_CRON_SECRET");
  }
});
