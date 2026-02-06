/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { useWallet } from "../src/composables/useWallet";

function mountWithWalletInstances(count: number) {
  const Root = {
    setup() {
      for (let i = 0; i < count; i += 1) {
        useWallet();
      }
      return () => h("div");
    },
  };

  const el = document.createElement("div");
  const app = createApp(Root);
  app.mount(el);
  return { app, el };
}

afterEach(() => {
  document.body.innerHTML = "";
  delete (window as unknown as { MiniAppSDK?: unknown }).MiniAppSDK;
});

describe("useWallet", () => {
  it("dedupes initial getAddress calls across multiple instances", async () => {
    const getAddress = vi.fn().mockResolvedValue("ADDR");
    (window as unknown as { MiniAppSDK?: unknown }).MiniAppSDK = {
      wallet: { getAddress },
      getConfig: () => ({}),
    };

    const { app } = mountWithWalletInstances(3);

    await nextTick();

    expect(getAddress).toHaveBeenCalledTimes(1);

    app.unmount();
  });
});
