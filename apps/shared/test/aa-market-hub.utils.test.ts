import { describe, expect, it } from "vitest";

import { getDefaultMarketHash } from "../../aa-market-hub/src/utils/aa-market";
import {
  relativeTime,
  statusLabel,
} from "../../aa-market-hub/src/components/ListingCard";

const t = (key: string, params?: Record<string, string | number>) => {
  const map: Record<string, string> = {
    statusActive: "active",
    statusSold: "sold",
    statusCancelled: "cancelled",
    statusUnknown: "unknown",
    timeJustNow: "just now",
    timeMinutesAgo: "{count}m ago",
    timeHoursAgo: "{count}h ago",
    timeDaysAgo: "{count}d ago",
  };
  let value = map[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }
  return value;
};

describe("AA Market Hub utils", () => {
  it("defaults the market hash to the canonical AAAddressMarket per network", () => {
    // The app's manifest declares both; the runtime registry lacks the testnet
    // entry, so the manifest fallback must still resolve a normalized hash.
    expect(getDefaultMarketHash("mainnet")).toBe(
      "0xae7afe3a85ab08bfd1d4907b35ae8b80c75b3a69",
    );
    expect(getDefaultMarketHash("testnet")).toBe(
      "0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf",
    );
  });

  it("localizes listing status, with an unknown fallback", () => {
    expect(statusLabel("active", t)).toBe("active");
    expect(statusLabel("sold", t)).toBe("sold");
    expect(statusLabel("cancelled", t)).toBe("cancelled");
    expect(statusLabel("weird", t)).toBe("unknown");
  });

  it("renders contract timestamps as localized relative time", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(relativeTime("0", t)).toBe("");
    expect(relativeTime("", t)).toBe("");
    expect(relativeTime(String(now - 10), t)).toBe("just now");
    expect(relativeTime(String(now - 120), t)).toBe("2m ago");
    expect(relativeTime(String(now - 7200), t)).toBe("2h ago");
    expect(relativeTime(String(now - 172800), t)).toBe("2d ago");
  });
});
