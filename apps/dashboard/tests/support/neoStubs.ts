import { Page } from "@playwright/test";

export type NeoStubOptions = {
  apiBase?: string;
  height?: number;
  block?: any;
  storageSummary?: any[];
  storage?: any[];
  storageDiff?: any[];
  snapshots?: any[];
};

// Stub common NEO endpoints so dashboard smoke tests can exercise block detail + storage flows without real data.
export async function stubNeoEndpoints(page: Page, options: NeoStubOptions = {}) {
  const apiBase = (options.apiBase || process.env.API_URL || "http://localhost:8080").replace(/\/$/, "");
  const apiOrigin = new URL(apiBase).origin;
  const height = options.height ?? 101;
  const block = options.block || {
    height,
    hash: "0xabc",
    state_root: "0xroot",
    block_time: new Date().toISOString(),
    tx_count: 1,
  };
  const storageSummary = options.storageSummary || [{ contract: "0xdead", kv_entries: 2, diff_entries: 1 }];
  const storage = options.storage || [{ contract: "0xdead", kv: [{ key: "00", value: "ff" }] }];
  const storageDiff = options.storageDiff || [{ contract: "0xdead", kv_diff: [{ key: "00", value: "aa" }] }];
  const snapshots = options.snapshots || [];

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === apiOrigin) {
      switch (url.pathname) {
        case "/neo/blocks":
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([block]),
          });
        case `/neo/blocks/${height}`:
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ block, transactions: [{ hash: "0xtx", ordinal: 0, vm_state: "HALT" }] }),
          });
        case `/neo/storage-summary/${height}`:
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(storageSummary),
          });
        case `/neo/storage/${height}`:
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(storage),
          });
        case `/neo/storage-diff/${height}`:
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(storageDiff),
          });
        case "/neo/snapshots":
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(snapshots),
          });
        default:
          break;
      }
    }
    return route.fallback();
  });
}
