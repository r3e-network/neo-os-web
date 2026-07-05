import { useOAuthStore } from "@/lib/oauth/store";
import type { OAuthAccount } from "@/lib/oauth/store";

const STORAGE_KEY = "oauth-accounts";

function resetStore() {
  useOAuthStore.setState({
    accounts: [],
    loading: null,
    error: null,
  });
}

function writePersistedAccounts(accounts: OAuthAccount[], version = 0) {
  // Another tab mutated localStorage; reflect that on disk so rehydrate() sees
  // the new value.
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state: { accounts }, version }),
  );
}

function dispatchOAuthStorageEvent(previousAccounts: OAuthAccount[]) {
  // jsdom does not synthesize the cross-tab `storage` event itself.
  const event = new StorageEvent("storage", {
    key: STORAGE_KEY,
    newValue: localStorage.getItem(STORAGE_KEY),
    oldValue: JSON.stringify({ state: { accounts: previousAccounts }, version: 0 }),
    storageArea: localStorage,
    url: window.location.href,
  });
  window.dispatchEvent(event);
}

describe("oauth store cross-tab sync", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it("adopts a linked account added in another tab", async () => {
    useOAuthStore.setState({ accounts: [] });

    writePersistedAccounts([
      {
        provider: "google",
        id: "google-1",
        email: "a@example.com",
        linkedAt: "2026-06-24T00:00:00.000Z",
      },
    ]);
    dispatchOAuthStorageEvent([]);

    // rehydrate is async; wait for the store to converge.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useOAuthStore.getState().accounts).toEqual([
      expect.objectContaining({ provider: "google", id: "google-1" }),
    ]);
  });

  it("removes an unlinked account when another tab drops it", async () => {
    const before: OAuthAccount[] = [
      {
        provider: "github",
        id: "gh-1",
        linkedAt: "2026-06-24T00:00:00.000Z",
      },
    ];
    useOAuthStore.setState({ accounts: before });

    writePersistedAccounts([]);
    dispatchOAuthStorageEvent(before);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useOAuthStore.getState().accounts).toEqual([]);
  });

  it("ignores storage events for unrelated keys", async () => {
    useOAuthStore.setState({
      accounts: [
        {
          provider: "twitter",
          id: "x-1",
          linkedAt: "2026-06-24T00:00:00.000Z",
        },
      ],
    });

    const event = new StorageEvent("storage", {
      key: "some-other-key",
      newValue: "x",
      oldValue: null,
      storageArea: localStorage,
      url: window.location.href,
    });
    window.dispatchEvent(event);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useOAuthStore.getState().accounts).toEqual([
      expect.objectContaining({ provider: "twitter", id: "x-1" }),
    ]);
  });
});
