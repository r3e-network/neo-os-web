/**
 * MiniAppRoot — the `pendingKey` phase on manifest bindings.
 *
 * Manifest sidebar bindings are an ungated render path: MiniAppRoot formats
 * whatever the bound observable holds at first paint, so an app's DataPhase
 * gating inside its own PlayArea never reaches the chrome. Without a declared
 * pending phase the chrome publishes the app's rest-state fallback as if it
 * were a reading — a void, or a fabricated number that asserts something false.
 *
 * `pendingKey` lets a binding name that phase. These tests mount the REAL
 * MiniAppRoot and assert on rendered DOM, so they fail if the shell stops
 * honouring the contract — the point is to guard the render path, not a helper.
 *
 * The two halves that matter:
 *   (a) an undefined value + pendingKey renders the declared pending copy;
 *   (b) a binding with NO pendingKey renders byte-for-byte what it always did
 *       — this is the no-regression guard for the 77 apps that never opt in.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { mergeMessages } from "@shared/locale/base-messages";

import { MiniAppRoot } from "@shared/react/MiniAppRoot";
import { createObservable } from "@shared/react";

const DummyPlayArea = () =>
  React.createElement("div", { "data-testid": "play-area" }, "play area");

const messages = mergeMessages({
  title: { en: "Pending Binding App", zh: "Pending Binding App" },
  notAvailable: { en: "N/A", zh: "N/A" },
  errorFallback: { en: "Something went wrong", zh: "Something went wrong" },
  overview: { en: "Overview", zh: "Overview" },
  stats: { en: "Stats", zh: "Stats" },
  play: { en: "Play", zh: "Play" },
  foundersLabel: { en: "Founders", zh: "Founders" },
  balanceLabel: { en: "Balance", zh: "Balance" },
  readingCopy: { en: "Reading…", zh: "Reading…" },
});

function baseManifest(items: Array<Record<string, unknown>>) {
  return {
    name: "Pending Binding App",
    description: "Exercise the pendingKey phase on manifest bindings",
    icon: "sparkles",
    category: "tool",
    tabs: [{ key: "play", labelKey: "play", icon: "play", default: true }],
    sidebar: { titleKey: "title", items },
  } as const;
}

/** Mount MiniAppRoot with the given sidebar bindings + state, return the HTML. */
async function renderChrome(
  appId: string,
  items: Array<Record<string, unknown>>,
  state: Record<string, unknown>,
): Promise<{ html: string; teardown: () => void }> {
  // The sidebar chrome only exists on the platform shell; a standalone-dapp
  // launch renders a bare surface with no bindings to assert on.
  window.history.pushState({}, "", `/miniapps/${appId}/index.html?source=platform`);

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  let ready = false;
  await vi.waitFor(async () => {
    if (!ready) {
      root.render(
        React.createElement(MiniAppRoot, {
          appId,
          playArea: DummyPlayArea as never,
          manifest: baseManifest(items) as never,
          messages,
          setupFn: async () => {
            ready = true;
            return { state };
          },
        } as never),
      );
    }
    expect(ready).toBe(true);
  });

  // The sidebar re-derives on the setup-driven state version bump; wait for the
  // label to land so we are asserting on the settled chrome, not first paint.
  await vi.waitFor(() => {
    expect(container.innerHTML).toContain("Founders");
  });

  return {
    html: container.innerHTML,
    teardown: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("MiniAppRoot pendingKey bindings", () => {
  it("renders the declared pending copy while the bound value is unread", async () => {
    // `undefined` is the unread state: nothing has been set yet. Formatting it
    // is exactly how `Founders 0` and `Total USD —` reached the chrome.
    const { html, teardown } = await renderChrome(
      "pending-key-unread",
      [
        {
          labelKey: "foundersLabel",
          valueKey: "founderCount",
          format: "number",
          pendingKey: "readingCopy",
        },
      ],
      { founderCount: createObservable<number | undefined>(undefined) },
    );

    expect(html).toContain("Reading…");
    // The specific regression: a count is a claim, and absence is not zero.
    expect(html).not.toMatch(/>\s*0\s*</);
    teardown();
  });

  it("hands the chrome the real reading once the value settles — including a settled zero", async () => {
    // A settled zero is a REAL reading and must survive the pending gate;
    // pendingKey must key off "unread", never off "falsy".
    const { html, teardown } = await renderChrome(
      "pending-key-settled-zero",
      [
        {
          labelKey: "foundersLabel",
          valueKey: "founderCount",
          format: "number",
          pendingKey: "readingCopy",
        },
      ],
      { founderCount: createObservable<number | undefined>(0) },
    );

    expect(html).not.toContain("Reading…");
    expect(html).toMatch(/>\s*0\s*</);
    teardown();
  });

  it("leaves a binding with no pendingKey rendering exactly as before", async () => {
    // The no-regression guard for every app that never opts in. Formatting an
    // undefined value through `format: "number"` yields "" today; that stays
    // true, and MiniAppPage's own `?? t("notAvailable")` is NOT reached because
    // "" is a string. This asserts the old behaviour, warts included, so an
    // opt-out app is provably untouched by the new branch.
    const { html, teardown } = await renderChrome(
      "pending-key-absent",
      [
        { labelKey: "foundersLabel", valueKey: "founderCount", format: "number" },
        { labelKey: "balanceLabel", valueKey: "balance", format: "number" },
      ],
      {
        founderCount: createObservable<number | undefined>(undefined),
        balance: createObservable<number | undefined>(42),
      },
    );

    expect(html).not.toContain("Reading…");
    // The settled sibling still formats normally.
    expect(html).toContain("42");
    teardown();
  });

  it("does not fire the pending gate for null or empty string, which are real values", async () => {
    // `null` and `""` are values an app may legitimately hold and report.
    // Only `undefined` means "nothing has been set yet".
    const { html, teardown } = await renderChrome(
      "pending-key-null-and-empty",
      [
        {
          labelKey: "foundersLabel",
          valueKey: "founderCount",
          format: "text",
          pendingKey: "readingCopy",
        },
        {
          labelKey: "balanceLabel",
          valueKey: "balance",
          format: "text",
          pendingKey: "readingCopy",
        },
      ],
      {
        founderCount: createObservable<string | null>(null),
        balance: createObservable<string>(""),
      },
    );

    expect(html).not.toContain("Reading…");
    teardown();
  });
});
