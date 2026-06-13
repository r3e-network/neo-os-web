import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ConsoleToolPanel,
  consoleAccentVars,
  type ConsoleResult,
  type ConsoleToolConfig,
} from "../components-react/ConsoleToolPanel";
import { MiniAppManifestContext } from "../react/context";
import { createObservable, type ObservableState } from "../react/context";
import type { MiniAppManifest } from "../types/miniapp-manifest";
import type { PlatformServices } from "../services";
import type { MiniAppLaunchContext } from "../utils/launch-params";
import { baseMessages, mergeMessages } from "../locale/base-messages";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

type LocalizedMessage = {
  en: string;
  zh: string;
};

const messages = mergeMessages({
  panelEyebrow: { en: "Console Lab", zh: "控制台实验室" },
  panelTitle: { en: "Panel Test Console", zh: "面板测试控制台" },
  panelDescription: { en: "Exercise the shared panel.", zh: "测试共享面板。" },
  runAction: { en: "Build Preview", zh: "构建预览" },
  topicLabel: { en: "Topic", zh: "主题" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Endpoint", zh: "端点" },
  statRequests: { en: "Requests", zh: "请求数" },
}) as Record<string, LocalizedMessage>;

function t(key: string, params: Record<string, string | number> = {}) {
  let text = messages[key]?.en ?? key;
  for (const [param, value] of Object.entries(params)) {
    text = text.replace(`{${param}}`, String(value));
  }
  return text;
}

function makeResult(digest: string): ConsoleResult {
  return {
    status: "Preview ready",
    summary: "Preview ready",
    rows: [{ label: "Topic", value: "value" }],
    payload: { kind: "test.request", digest },
  };
}

function makeConfig(overrides: Partial<ConsoleToolConfig> = {}): ConsoleToolConfig {
  return {
    titleKey: "panelTitle",
    eyebrowKey: "panelEyebrow",
    descriptionKey: "panelDescription",
    primaryActionKey: "runAction",
    resetActionKey: "reset",
    copyActionKey: "copy",
    copiedKey: "copied",
    fields: [
      {
        key: "topic",
        labelKey: "topicLabel",
        type: "text",
        defaultValue: "default-topic",
      },
    ],
    buildResult: () => makeResult("0xpreview01"),
    ...overrides,
  };
}

function makeState(): ObservableState {
  return {
    networkLabel: createObservable("Morpheus Mainnet"),
    endpointLabel: createObservable("Panel test"),
    requestCount: createObservable(0),
    lastDigest: createObservable("—"),
    lastStatus: createObservable("Ready"),
  };
}

function makeLaunchContext(
  params: Record<string, string> = {},
): MiniAppLaunchContext {
  return {
    appId: "miniapp-panel-test",
    source: "onegate",
    operation: null,
    tab: null,
    network: "mainnet",
    params,
    keys: Object.keys(params),
    hasParams: Object.keys(params).length > 0,
    signature: "",
  };
}

function makeServices() {
  return {
    clipboard: { copy: vi.fn(async () => undefined) },
  } as unknown as PlatformServices;
}

function renderPanel({
  config = makeConfig(),
  state = makeState(),
  launchContext = null as MiniAppLaunchContext | null,
  setStatus = vi.fn(),
  manifest = null as MiniAppManifest | null,
} = {}) {
  const view = render(
    <MiniAppManifestContext.Provider value={manifest}>
      <ConsoleToolPanel
        config={config}
        t={t}
        state={state}
        services={makeServices()}
        setStatus={setStatus}
        launchContext={launchContext}
      />
    </MiniAppManifestContext.Provider>,
  );
  return { view, state, setStatus };
}

afterEach(() => cleanup());

describe("ConsoleToolPanel reset", () => {
  it("re-applies deep-link launch params instead of falling back to field defaults", () => {
    renderPanel({ launchContext: makeLaunchContext({ topic: "deep-link-topic" }) });

    const input = screen.getByLabelText("Topic") as HTMLInputElement;
    expect(input.value).toBe("deep-link-topic");

    fireEvent.change(input, { target: { value: "edited-by-user" } });
    expect(input.value).toBe("edited-by-user");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    // Without launch-param re-application this regressed to "default-topic".
    expect((screen.getByLabelText("Topic") as HTMLInputElement).value).toBe(
      "deep-link-topic",
    );
  });

  it("restores field defaults on reset when the app was not deep-linked", () => {
    renderPanel({ launchContext: makeLaunchContext() });

    const input = screen.getByLabelText("Topic") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "edited-by-user" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect((screen.getByLabelText("Topic") as HTMLInputElement).value).toBe(
      "default-topic",
    );
  });
});

describe("ConsoleToolPanel preview-mode framing", () => {
  it("shows the honest preview-only notice when no execute hook is configured", () => {
    renderPanel();
    expect(
      screen.getByText(baseMessages.consolePreviewNotice.en),
    ).toBeTruthy();
  });

  it("hides the notice and offers a live-dispatch button when execute is wired", () => {
    renderPanel({
      config: makeConfig({ execute: async () => makeResult("0xlive01") }),
    });
    expect(
      screen.queryByText(baseMessages.consolePreviewNotice.en),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: baseMessages.consoleExecuteAction.en }),
    ).toBeTruthy();
  });
});

describe("ConsoleToolPanel execute hook", () => {
  it("applies a successful live result: digest, request counter, success toast", async () => {
    const execute = vi.fn(async () => makeResult("0xlive02"));
    const { state, setStatus } = renderPanel({ config: makeConfig({ execute }) });

    fireEvent.click(
      screen.getByRole("button", { name: baseMessages.consoleExecuteAction.en }),
    );

    await waitFor(() => expect(state.requestCount?.get()).toBe(1));
    expect(execute).toHaveBeenCalledWith(
      { topic: "default-topic" },
      expect.any(Function),
    );
    expect(state.lastDigest?.get()).toBe("0xlive02");
    expect(state.lastStatus?.get()).toBe("Preview ready");
    expect(setStatus).toHaveBeenCalledWith("Preview ready", "success");
  });

  it("classifies an input_required live result as a warning without counting it", async () => {
    const execute = vi.fn(
      async (): Promise<ConsoleResult> => ({
        status: "Input required",
        summary: "Input required",
        rows: [],
        payload: { status: "input_required" },
      }),
    );
    const { state, setStatus } = renderPanel({ config: makeConfig({ execute }) });

    fireEvent.click(
      screen.getByRole("button", { name: baseMessages.consoleExecuteAction.en }),
    );

    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith("Input required", "warning"),
    );
    expect(state.requestCount?.get()).toBe(0);
    // Digest placeholder is preserved, never blanked.
    expect(state.lastDigest?.get()).toBe("—");
  });

  it("surfaces a failed dispatch as an error toast and keeps panel state intact", async () => {
    const execute = vi.fn(async () => {
      throw new Error("oracle lane rejected the request");
    });
    const { state, setStatus } = renderPanel({ config: makeConfig({ execute }) });

    fireEvent.click(
      screen.getByRole("button", { name: baseMessages.consoleExecuteAction.en }),
    );

    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith(
        "oracle lane rejected the request",
        "error",
      ),
    );
    expect(state.requestCount?.get()).toBe(0);
    expect(state.lastDigest?.get()).toBe("—");
    // The button recovers from its loading state for a retry.
    await waitFor(() => {
      const button = screen.getByRole("button", {
        name: baseMessages.consoleExecuteAction.en,
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
  });

  it("falls back to the shared unexpectedError copy for empty rejections", async () => {
    const execute = vi.fn(async () => {
      throw new Error("");
    });
    const { setStatus } = renderPanel({ config: makeConfig({ execute }) });

    fireEvent.click(
      screen.getByRole("button", { name: baseMessages.consoleExecuteAction.en }),
    );

    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith(
        baseMessages.unexpectedError.en,
        "error",
      ),
    );
  });
});

describe("ConsoleToolPanel hero meta", () => {
  it("renders the session Requests counter by default", () => {
    renderPanel();
    expect(screen.getByText("Requests")).toBeTruthy();
  });

  it("omits the Requests counter when hideRequestCount is set", () => {
    renderPanel({ config: makeConfig({ hideRequestCount: true }) });
    expect(screen.queryByText("Requests")).toBeNull();
    // The other meta entries stay.
    expect(screen.getByText("Network")).toBeTruthy();
    expect(screen.getByText("Endpoint")).toBeTruthy();
  });
});

describe("ConsoleToolPanel accent threading", () => {
  it("sets --console-accent custom properties from the manifest accentColor", () => {
    const manifest: MiniAppManifest = {
      name: "Panel Test",
      theme: { family: "default", accentColor: "#22d3ee" },
    };
    const { view } = renderPanel({ manifest });

    const root = view.container.querySelector(".console-tool") as HTMLElement;
    expect(root.style.getPropertyValue("--console-accent")).toBe("#22d3ee");
    expect(root.style.getPropertyValue("--console-accent-soft")).toBe(
      "rgba(34, 211, 238, 0.12)",
    );
  });

  it("leaves the violet fallback in charge when no valid accent exists", () => {
    const manifest: MiniAppManifest = {
      name: "Panel Test",
      theme: { family: "default", accentColor: "not-a-color" },
    };
    const { view } = renderPanel({ manifest });

    const root = view.container.querySelector(".console-tool") as HTMLElement;
    expect(root.style.getPropertyValue("--console-accent")).toBe("");
  });

  it("expands 3-digit hex accents before deriving the soft tint", () => {
    expect(consoleAccentVars("#1c8")).toMatchObject({
      "--console-accent": "#11cc88",
      "--console-accent-soft": "rgba(17, 204, 136, 0.12)",
    });
    expect(consoleAccentVars(undefined)).toBeUndefined();
    expect(consoleAccentVars("16c784")).toBeUndefined();
  });
});
