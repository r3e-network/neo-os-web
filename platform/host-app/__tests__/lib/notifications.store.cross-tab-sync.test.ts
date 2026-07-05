import { useNotificationStore } from "@/lib/notifications/store";
import type { NotificationEvent } from "@/lib/notifications/types";

const STORAGE_KEY = "notification-store";

function resetStore() {
  useNotificationStore.setState({
    preferences: null,
    events: [],
    chainHealth: null,
    loading: false,
    error: null,
  });
}

function writePersistedEvents(events: NotificationEvent[], version = 0) {
  // Another tab mutated localStorage; reflect that on disk so rehydrate() sees
  // the new value.
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state: { events }, version }),
  );
}

function dispatchNotificationStorageEvent(previousEvents: NotificationEvent[]) {
  // jsdom does not synthesize the cross-tab `storage` event itself.
  const event = new StorageEvent("storage", {
    key: STORAGE_KEY,
    newValue: localStorage.getItem(STORAGE_KEY),
    oldValue: JSON.stringify({ state: { events: previousEvents }, version: 0 }),
    storageArea: localStorage,
    url: window.location.href,
  });
  window.dispatchEvent(event);
}

const baseEvent = (overrides: Partial<NotificationEvent> = {}): NotificationEvent =>
  ({
    id: "evt-1",
    type: "info",
    title: "Test",
    message: "msg",
    timestamp: "2026-06-24T00:00:00.000Z",
    read: false,
    ...overrides,
  } as NotificationEvent);

describe("notification store cross-tab sync", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it("adopts read-state changes made in another tab", async () => {
    const unread = baseEvent({ id: "evt-1", read: false });
    useNotificationStore.setState({ events: [unread] });

    // Another tab marked the same event read.
    writePersistedEvents([baseEvent({ id: "evt-1", read: true })]);
    dispatchNotificationStorageEvent([unread]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useNotificationStore.getState().events).toEqual([
      expect.objectContaining({ id: "evt-1", read: true }),
    ]);
  });

  it("adopts a newly arrived event added in another tab", async () => {
    useNotificationStore.setState({ events: [] });

    writePersistedEvents([baseEvent({ id: "evt-new", read: false })]);
    dispatchNotificationStorageEvent([]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useNotificationStore.getState().events).toEqual([
      expect.objectContaining({ id: "evt-new" }),
    ]);
  });

  it("ignores storage events for unrelated keys", async () => {
    const existing = [baseEvent({ id: "evt-1", read: false })];
    useNotificationStore.setState({ events: existing });

    const event = new StorageEvent("storage", {
      key: "some-other-key",
      newValue: "x",
      oldValue: null,
      storageArea: localStorage,
      url: window.location.href,
    });
    window.dispatchEvent(event);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useNotificationStore.getState().events).toEqual(existing);
  });
});
