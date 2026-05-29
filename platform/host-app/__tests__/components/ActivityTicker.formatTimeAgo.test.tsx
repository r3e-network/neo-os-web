import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ActivityTicker } from "../../components/ActivityTicker";
import type { OnChainActivity } from "../../components/types";

/**
 * `formatTimeAgo` in ActivityTicker.tsx is module-private, so we exercise it
 * through the rendered component. Each activity row renders the relative-time
 * string in a trailing <span> that is the title span's next sibling.
 *
 * A fixed "now" makes the diff math deterministic without touching source.
 */
const FIXED_NOW = new Date("2026-05-29T12:00:00.000Z").getTime();

function makeActivity(
  overrides: Partial<OnChainActivity> & Pick<OnChainActivity, "timestamp">,
): OnChainActivity {
  return {
    id: overrides.id ?? "act-1",
    type: "transaction",
    app_id: null,
    title: overrides.title ?? "Tx activity",
    description: "desc",
    ...overrides,
  };
}

/**
 * Read the relative-time text rendered for the row containing `title`.
 *
 * The time span is the title span's next element sibling (see ActivityTicker
 * row markup). Locating it by DOM position rather than text content means an
 * empty-string time (the guard's output) is still readable, not "not found".
 */
function timeAgoFor(title: string): string {
  const titleEl = screen.getByText(title);
  const timeEl = titleEl.nextElementSibling;
  if (!timeEl) throw new Error("relative-time element not found");
  return timeEl.textContent ?? "";
}

describe("ActivityTicker formatTimeAgo (relative time)", () => {
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("formats sub-minute differences in seconds", () => {
    render(
      <ActivityTicker
        activities={[
          makeActivity({
            id: "s",
            title: "Seconds row",
            timestamp: new Date(FIXED_NOW - 5_000).toISOString(),
          }),
        ]}
      />,
    );

    expect(timeAgoFor("Seconds row")).toBe("5s ago");
  });

  it("formats differences under an hour in minutes", () => {
    render(
      <ActivityTicker
        activities={[
          makeActivity({
            id: "m",
            title: "Minutes row",
            timestamp: new Date(FIXED_NOW - 5 * 60_000).toISOString(),
          }),
        ]}
      />,
    );

    expect(timeAgoFor("Minutes row")).toBe("5m ago");
  });

  it("formats differences under a day in hours", () => {
    render(
      <ActivityTicker
        activities={[
          makeActivity({
            id: "h",
            title: "Hours row",
            timestamp: new Date(FIXED_NOW - 3 * 3_600_000).toISOString(),
          }),
        ]}
      />,
    );

    expect(timeAgoFor("Hours row")).toBe("3h ago");
  });

  it("formats differences of a day or more in days", () => {
    render(
      <ActivityTicker
        activities={[
          makeActivity({
            id: "d",
            title: "Days row",
            timestamp: new Date(FIXED_NOW - 2 * 86_400_000).toISOString(),
          }),
        ]}
      />,
    );

    expect(timeAgoFor("Days row")).toBe("2d ago");
  });

  it("uses seconds for the just-now (zero diff) case", () => {
    render(
      <ActivityTicker
        activities={[
          makeActivity({
            id: "now",
            title: "Now row",
            timestamp: new Date(FIXED_NOW).toISOString(),
          }),
        ]}
      />,
    );

    expect(timeAgoFor("Now row")).toBe("0s ago");
  });

  describe("boundary transitions", () => {
    it("switches from seconds to minutes exactly at 60s", () => {
      render(
        <ActivityTicker
          activities={[
            makeActivity({
              id: "b60",
              title: "Boundary 60s",
              timestamp: new Date(FIXED_NOW - 60_000).toISOString(),
            }),
          ]}
        />,
      );

      // diff === 60 is no longer < 60, so it rolls into the minutes bucket.
      expect(timeAgoFor("Boundary 60s")).toBe("1m ago");
    });

    it("still reports seconds at 59s", () => {
      render(
        <ActivityTicker
          activities={[
            makeActivity({
              id: "b59",
              title: "Boundary 59s",
              timestamp: new Date(FIXED_NOW - 59_000).toISOString(),
            }),
          ]}
        />,
      );

      expect(timeAgoFor("Boundary 59s")).toBe("59s ago");
    });

    it("switches from minutes to hours exactly at 3600s", () => {
      render(
        <ActivityTicker
          activities={[
            makeActivity({
              id: "b3600",
              title: "Boundary 1h",
              timestamp: new Date(FIXED_NOW - 3_600_000).toISOString(),
            }),
          ]}
        />,
      );

      expect(timeAgoFor("Boundary 1h")).toBe("1h ago");
    });

    it("switches from hours to days exactly at 86400s", () => {
      render(
        <ActivityTicker
          activities={[
            makeActivity({
              id: "b86400",
              title: "Boundary 1d",
              timestamp: new Date(FIXED_NOW - 86_400_000).toISOString(),
            }),
          ]}
        />,
      );

      expect(timeAgoFor("Boundary 1d")).toBe("1d ago");
    });
  });

  describe("non-finite / invalid timestamp guard", () => {
    it("renders an empty relative-time string for a malformed timestamp", () => {
      render(
        <ActivityTicker
          activities={[
            makeActivity({
              id: "bad",
              title: "Malformed row",
              timestamp: "not-a-date",
            }),
          ]}
        />,
      );

      // Guard: new Date("not-a-date").getTime() === NaN → not finite → "".
      expect(timeAgoFor("Malformed row")).toBe("");
    });

    it("renders an empty relative-time string for an empty timestamp", () => {
      render(
        <ActivityTicker
          activities={[
            makeActivity({ id: "empty", title: "Empty ts row", timestamp: "" }),
          ]}
        />,
      );

      // new Date("").getTime() === NaN → not finite → guard returns "".
      expect(timeAgoFor("Empty ts row")).toBe("");
    });

    it("renders an empty relative-time string for an undefined timestamp", () => {
      render(
        <ActivityTicker
          activities={[
            makeActivity({
              id: "undef",
              title: "Undefined ts row",
              timestamp: undefined as unknown as string,
            }),
          ]}
        />,
      );

      // new Date(undefined).getTime() === NaN → not finite → guard returns "".
      expect(timeAgoFor("Undefined ts row")).toBe("");
    });

    it("renders an empty relative-time string for emoji/garbage input", () => {
      render(
        <ActivityTicker
          activities={[
            makeActivity({
              id: "emoji",
              title: "Emoji ts row",
              timestamp: "💥 invalid",
            }),
          ]}
        />,
      );

      expect(timeAgoFor("Emoji ts row")).toBe("");
    });

    /**
     * A literal `null` timestamp must render an empty label. Without the
     * falsy guard, `new Date(null).getTime() === 0` (Unix epoch) is finite and
     * would pass `Number.isFinite`, producing a nonsensical "<huge>d ago".
     * `OnChainActivity.timestamp` is typed `string`, but `null` can leak in
     * from `any`-typed API rows with a missing field, so the guard is required.
     */
    it("guards a literal null timestamp and renders an empty label", () => {
      render(
        <ActivityTicker
          activities={[
            makeActivity({
              id: "null",
              title: "Null ts row",
              timestamp: null as unknown as string,
            }),
          ]}
        />,
      );

      expect(timeAgoFor("Null ts row")).toBe("");
    });

    it("does not crash and shows valid rows even when another row is malformed", () => {
      render(
        <ActivityTicker
          activities={[
            makeActivity({
              id: "good",
              title: "Good row",
              timestamp: new Date(FIXED_NOW - 10_000).toISOString(),
            }),
            makeActivity({
              id: "bad2",
              title: "Bad row",
              timestamp: "💥 invalid",
            }),
          ]}
        />,
      );

      expect(timeAgoFor("Good row")).toBe("10s ago");
      expect(timeAgoFor("Bad row")).toBe("");
    });
  });
});
