import { act, renderHook } from "@testing-library/react";
import { useCommunity } from "../../hooks/useCommunity";

describe("useCommunity env access", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  it("reads NEXT_PUBLIC_SUPABASE_URL lazily at hook usage time", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://lazy.supabase.co";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ comments: [], has_more: false }),
    });

    const { result } = renderHook(() => useCommunity({ appId: "test-app" }));

    await act(async () => {
      await result.current.fetchComments();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://lazy.supabase.co/functions/v1/social-comments?app_id=test-app&limit=20&offset=0&parent_id=null",
      expect.any(Object),
    );
  });
});
