/**
 * S9 clipboard + share spec (framework-extraction plan §2/S9).
 *
 * Covers: copy/copyAddress successKey toasts through the injected notify fn,
 * ClipboardService-parity defaults ("copied"/"copyFailed" base-message keys),
 * navigator.clipboard + legacy execCommand lanes, and share.url's
 * navigator.share → clipboard fallback with AbortError silenced
 * (recovery-guardian semantics).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createClipboardSurface,
  createShareSurface,
  type FrameworkNotifyLike,
} from "../clipboard";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

function makeNotify() {
  return {
    success: vi.fn(),
    error: vi.fn(),
  } satisfies FrameworkNotifyLike;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { clipboard?: unknown }).clipboard;
  delete (document as { execCommand?: unknown }).execCommand;
});

describe("S9 app.clipboard", () => {
  it("copies through the injected writer and toasts the default successKey", async () => {
    const notify = makeNotify();
    const writeText = vi.fn(async () => {});
    const clipboard = createClipboardSurface({ notify, writeText });

    await expect(clipboard.copy("hello")).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith("hello");
    // Default key matches shared base-messages so toast strings stay byte-identical.
    expect(notify.success).toHaveBeenCalledWith("copied");
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("toasts a custom successKey (red-envelope/soulbound-style link copies)", async () => {
    const notify = makeNotify();
    const clipboard = createClipboardSurface({ notify, writeText: async () => {} });

    await clipboard.copy("https://example.com/claim", { successKey: "shareLinkCopied" });

    expect(notify.success).toHaveBeenCalledWith("shareLinkCopied");
  });

  it("reports copy failures with the copyFailed fallback and resolves false", async () => {
    const notify = makeNotify();
    const failure = new Error("denied");
    const clipboard = createClipboardSurface({
      notify,
      writeText: async () => {
        throw failure;
      },
    });

    await expect(clipboard.copy("secret")).resolves.toBe(false);

    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith(failure, "copyFailed");
  });

  it("uses navigator.clipboard.writeText when no writer is injected", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const notify = makeNotify();
    const clipboard = createClipboardSurface({ notify });

    await expect(clipboard.copy("native")).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith("native");
    expect(notify.success).toHaveBeenCalledWith("copied");
  });

  it("falls back to the legacy textarea + execCommand lane (ClipboardService parity)", async () => {
    const execCommand = vi.fn(() => true);
    (document as { execCommand?: unknown }).execCommand = execCommand;
    const clipboard = createClipboardSurface({ notify: makeNotify() });

    await expect(clipboard.copy("legacy")).resolves.toBe(true);

    expect(execCommand).toHaveBeenCalledWith("copy");
    // The temporary textarea must not leak into the document.
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("degrades to a reported failure when the host has no clipboard at all", async () => {
    const notify = makeNotify();
    const clipboard = createClipboardSurface({ notify });

    await expect(clipboard.copy("nowhere")).resolves.toBe(false);

    expect(notify.error).toHaveBeenCalledWith(expect.any(Error), "copyFailed");
  });

  it("copies the connected wallet address with a per-app successKey", async () => {
    const notify = makeNotify();
    const writeText = vi.fn(async () => {});
    const clipboard = createClipboardSurface({
      notify,
      writeText,
      address: () => ADDRESS,
    });

    await expect(clipboard.copyAddress("addressCopied")).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith(ADDRESS);
    expect(notify.success).toHaveBeenCalledWith("addressCopied");
  });

  it("defaults copyAddress to the base copied toast", async () => {
    const notify = makeNotify();
    const clipboard = createClipboardSurface({
      notify,
      writeText: async () => {},
      address: () => ADDRESS,
    });

    await clipboard.copyAddress();

    expect(notify.success).toHaveBeenCalledWith("copied");
  });

  it("is a silent no-op when no wallet is connected", async () => {
    const notify = makeNotify();
    const writeText = vi.fn(async () => {});

    const disconnected = createClipboardSurface({ notify, writeText, address: () => null });
    await expect(disconnected.copyAddress()).resolves.toBe(false);

    const noAccessor = createClipboardSurface({ notify, writeText });
    await expect(noAccessor.copyAddress()).resolves.toBe(false);

    expect(writeText).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("stays silent-safe when no notify fn is injected", async () => {
    const clipboard = createClipboardSurface({ writeText: async () => {} });
    await expect(clipboard.copy("quiet")).resolves.toBe(true);
  });
});

describe("S9 app.share", () => {
  it("prefers the native share sheet and passes web URLs as { url }", async () => {
    const notify = makeNotify();
    const share = vi.fn(async () => {});
    const surface = createShareSurface({ notify, share });

    await expect(
      surface.url("https://example.com/preview", { sharedKey: "previewLinkShared" }),
    ).resolves.toBe("shared");

    expect(share).toHaveBeenCalledWith({ url: "https://example.com/preview" });
    expect(notify.success).toHaveBeenCalledWith("previewLinkShared");
  });

  it("shares plain text payloads as { text } and skips the toast without sharedKey", async () => {
    const notify = makeNotify();
    const share = vi.fn(async () => {});
    const surface = createShareSurface({ notify, share });

    await expect(surface.url("my tarot reading")).resolves.toBe("shared");

    expect(share).toHaveBeenCalledWith({ text: "my tarot reading" });
    // The native share sheet is its own feedback.
    expect(notify.success).not.toHaveBeenCalled();
  });

  it("silences a user-cancelled share (AbortError — recovery-guardian semantics)", async () => {
    const notify = makeNotify();
    const abort = new Error("Share canceled");
    abort.name = "AbortError";
    const surface = createShareSurface({
      notify,
      share: async () => {
        throw abort;
      },
    });

    await expect(surface.url("https://example.com")).resolves.toBe("dismissed");

    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("surfaces non-abort share failures through notify.error", async () => {
    const notify = makeNotify();
    const failure = new Error("share broken");
    const surface = createShareSurface({
      notify,
      share: async () => {
        throw failure;
      },
    });

    await expect(surface.url("https://example.com")).resolves.toBe("failed");

    expect(notify.error).toHaveBeenCalledWith(failure, "copyFailed");
  });

  it("falls back to clipboard and reports it as a copy when share is unavailable", async () => {
    const notify = makeNotify();
    const writeText = vi.fn(async () => {});
    const surface = createShareSurface({ notify, writeText, share: null });

    await expect(
      surface.url("https://example.com/credential", { copiedKey: "credentialLinkCopied" }),
    ).resolves.toBe("copied");

    expect(writeText).toHaveBeenCalledWith("https://example.com/credential");
    expect(notify.success).toHaveBeenCalledWith("credentialLinkCopied");
  });

  it("defaults the fallback toast to the base copied key", async () => {
    const notify = makeNotify();
    const surface = createShareSurface({ notify, writeText: async () => {}, share: null });

    await expect(surface.url("https://example.com")).resolves.toBe("copied");

    expect(notify.success).toHaveBeenCalledWith("copied");
  });

  it("autodetects the missing Web Share API and uses the clipboard lane", async () => {
    // jsdom exposes no navigator.share — the surface must fall back on its own.
    const notify = makeNotify();
    const writeText = vi.fn(async () => {});
    const surface = createShareSurface({ notify, writeText });

    await expect(surface.url("https://example.com")).resolves.toBe("copied");

    expect(writeText).toHaveBeenCalled();
  });

  it("reports a failed fallback copy once, through the clipboard error toast", async () => {
    const notify = makeNotify();
    const failure = new Error("no clipboard");
    const surface = createShareSurface({
      notify,
      share: null,
      writeText: async () => {
        throw failure;
      },
    });

    await expect(surface.url("https://example.com")).resolves.toBe("failed");

    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith(failure, "copyFailed");
  });

  it("treats empty values as a silent no-op", async () => {
    const notify = makeNotify();
    const share = vi.fn(async () => {});
    const surface = createShareSurface({ notify, share });

    await expect(surface.url("   ")).resolves.toBe("failed");

    expect(share).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });
});
