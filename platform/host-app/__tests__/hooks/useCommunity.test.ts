/**
 * Unit tests for useCommunity hook
 * Target: ≥90% coverage
 */

import { renderHook, act } from "@testing-library/react";
import { useCommunity } from "../../hooks/useCommunity";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("useCommunity", () => {
  const mockComments = [
    { id: "c1", content: "Comment 1", upvotes: 5, downvotes: 1 },
    { id: "c2", content: "Comment 2", upvotes: 3, downvotes: 0 },
  ];

  const mockRating = {
    app_id: "test-app",
    avg_rating: 4.2,
    total_ratings: 100,
    distribution: { "5": 50, "4": 30, "3": 10, "2": 5, "1": 5 },
  };

  const mockProof = {
    verified: true,
    interaction_count: 5,
    can_rate: true,
    can_comment: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("Initial State", () => {
    it("initializes with empty comments array", () => {
      const { result } = renderHook(() => useCommunity({ appId: "test-app" }));
      expect(result.current.comments).toEqual([]);
    });

    it("initializes with null rating", () => {
      const { result } = renderHook(() => useCommunity({ appId: "test-app" }));
      expect(result.current.rating).toBeNull();
    });

    it("initializes with loading false", () => {
      const { result } = renderHook(() => useCommunity({ appId: "test-app" }));
      expect(result.current.loading).toBe(false);
    });
  });

  describe("fetchComments", () => {
    it("fetches comments and updates state", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ comments: mockComments, has_more: true }),
      });

      const { result } = renderHook(() => useCommunity({ appId: "test-app" }));

      await act(async () => {
        await result.current.fetchComments();
      });

      expect(result.current.comments).toEqual(mockComments);
      expect(result.current.hasMore).toBe(true);
    });

    it("appends comments when offset > 0", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: [mockComments[0]], has_more: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ comments: [mockComments[1]], has_more: false }),
        });

      const { result } = renderHook(() => useCommunity({ appId: "test-app" }));

      await act(async () => {
        await result.current.fetchComments(0);
      });

      await act(async () => {
        await result.current.fetchComments(1);
      });

      expect(result.current.comments).toHaveLength(2);
    });

    it("sets loading state during fetch", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce({
        ok: true,
        json: () => promise,
      });

      const { result } = renderHook(() => useCommunity({ appId: "test-app" }));

      act(() => {
        result.current.fetchComments();
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolvePromise!({ comments: [], has_more: false });
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe("fetchRating", () => {
    it("fetches rating and updates state", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRating),
      });

      const { result } = renderHook(() => useCommunity({ appId: "test-app" }));

      await act(async () => {
        await result.current.fetchRating();
      });

      expect(result.current.rating).toEqual(mockRating);
    });
  });

  describe("verifyProof", () => {
    it("verifies proof and updates state when token provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProof),
      });

      const { result } = renderHook(() => useCommunity({ appId: "test-app", token: "test-token" }));

      await act(async () => {
        await result.current.verifyProof();
      });

      expect(result.current.proof).toEqual(mockProof);
    });

    it("does nothing when no token provided", async () => {
      const { result } = renderHook(() => useCommunity({ appId: "test-app" }));

      await act(async () => {
        await result.current.verifyProof();
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.proof).toBeNull();
    });
  });

  describe("Authorization Headers", () => {
    it("includes Authorization header when token provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ comments: [], has_more: false }),
      });

      const { result } = renderHook(() => useCommunity({ appId: "test-app", token: "my-token" }));

      await act(async () => {
        await result.current.fetchComments();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer my-token",
          }),
        }),
      );
    });
  });
});
