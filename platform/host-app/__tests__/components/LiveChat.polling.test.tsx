/**
 * LiveChat polling tests (A4).
 *
 * Regressions covered:
 * - the 5s message poll must PAUSE while the document is hidden so a
 *   backgrounded tab does not keep re-downloading the chat history.
 * - the loading skeleton must only show on the initial fetch — background poll
 *   ticks must not toggle `loading` (the panel flickered every 5s otherwise).
 */

import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";
import { LiveChat } from "../../components/features/chat/LiveChat";

jest.mock("../../lib/fetch-client", () => ({
  fetchJSON: jest.fn(),
  fetchOK: jest.fn(),
}));

import { fetchJSON } from "../../lib/fetch-client";

const fetchJSONMock = fetchJSON as jest.MockedFunction<typeof fetchJSON>;

const POLL_INTERVAL = 5000;

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

async function flushFetches() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function openChat() {
  // The poll only runs while the chat panel is open.
  fireEvent.click(screen.getByLabelText("Toggle chat"));
}

// jsdom does not implement scrollIntoView; the panel auto-scrolls on new
// messages, so stub it.
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

describe("LiveChat polling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fetchJSONMock.mockReset();
    fetchJSONMock.mockResolvedValue({ messages: [], participantCount: 0 });
    setVisibilityState("visible");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("polls every interval while visible and open", async () => {
    render(<LiveChat appId="miniapp-demo" walletAddress="NAddr" />);
    openChat();
    await flushFetches();
    expect(fetchJSONMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL);
    });
    await flushFetches();
    expect(fetchJSONMock).toHaveBeenCalledTimes(2);
  });

  it("pauses polling while the document is hidden", async () => {
    render(<LiveChat appId="miniapp-demo" walletAddress="NAddr" />);
    openChat();
    await flushFetches();
    expect(fetchJSONMock).toHaveBeenCalledTimes(1);

    setVisibilityState("hidden");
    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL * 3);
    });
    await flushFetches();
    // No further fetches while the tab is backgrounded.
    expect(fetchJSONMock).toHaveBeenCalledTimes(1);

    // Becoming visible again fires one immediate refresh.
    setVisibilityState("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flushFetches();
    expect(fetchJSONMock).toHaveBeenCalledTimes(2);
  });

  it("only shows the loading skeleton on the initial fetch, not on poll ticks", async () => {
    // Hold the first fetch open so the skeleton is observable.
    let resolveFirst: (value: { messages: never[]; participantCount: number }) => void =
      () => {};
    fetchJSONMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    render(<LiveChat appId="miniapp-demo" walletAddress="NAddr" />);
    openChat();

    // Initial fetch in flight → skeleton visible.
    await waitFor(() =>
      expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
        0,
      ),
    );

    await act(async () => {
      resolveFirst({ messages: [], participantCount: 0 });
    });
    await flushFetches();
    // Initial fetch settled → empty state, no skeleton.
    expect(document.querySelectorAll(".animate-pulse").length).toBe(0);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();

    // A background poll tick must not bring the skeleton back.
    fetchJSONMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ messages: [], participantCount: 0 }),
            100,
          );
        }),
    );
    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL);
    });
    expect(document.querySelectorAll(".animate-pulse").length).toBe(0);
  });
});
