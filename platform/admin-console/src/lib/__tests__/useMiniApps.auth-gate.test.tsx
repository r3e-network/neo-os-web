import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMiniApps } from "../hooks/useMiniApps";
import { createWrapper, mockFetchResponse } from "./test-utils";

describe("useMiniApps admin access gate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call protected MiniApp APIs before an admin key is ready", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(await mockFetchResponse([]));

    renderHook(() => useMiniApps({ enabled: false }), {
      wrapper: createWrapper(),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads MiniApps once admin access is ready", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(await mockFetchResponse([]));

    const { result } = renderHook(() => useMiniApps({ enabled: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/miniapps",
      expect.objectContaining({
        headers: {},
      }),
    );
  });
});
