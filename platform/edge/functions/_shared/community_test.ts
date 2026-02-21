/**
 * Unit tests for Community System Shared Utilities
 * Target: ≥90% coverage
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  verifyProofOfInteraction,
  checkSpamLimit,
  logSpamAction,
  getCommentVoteCounts,
  isDeveloperOfApp,
} from "./community.ts";

// -----------------------------------------------------------------------------
// Mock Supabase Client Factory
// -----------------------------------------------------------------------------

function createMockSupabase(
  overrides: {
    fromData?: unknown;
    fromError?: Error | null;
    rpcData?: unknown;
    rpcError?: Error | null;
    singleData?: unknown;
    singleError?: Error | null;
  } = {},
) {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          eq: (_col2: string, _val2: string) => ({
            limit: (_n: number) =>
              Promise.resolve({
                data: overrides.fromData ?? null,
                error: overrides.fromError ?? null,
              }),
          }),
          single: () =>
            Promise.resolve({
              data: overrides.singleData ?? null,
              error: overrides.singleError ?? null,
            }),
        }),
        in: (_col: string, _vals: string[]) =>
          Promise.resolve({
            data: overrides.fromData ?? null,
            error: overrides.fromError ?? null,
          }),
      }),
    }),
    rpc: (_fn: string, _params: Record<string, unknown>) =>
      Promise.resolve({
        data: overrides.rpcData ?? null,
        error: overrides.rpcError ?? null,
      }),
  } as unknown as Parameters<typeof verifyProofOfInteraction>[0];
}

// -----------------------------------------------------------------------------
// verifyProofOfInteraction Tests
// -----------------------------------------------------------------------------

Deno.test("verifyProofOfInteraction returns verified=true when cached proof exists", async () => {
  const mockSupabase = createMockSupabase({
    fromData: [{ tx_hash: "0xabc123", verified_at: "2025-01-01T00:00:00Z" }],
  });

  const result = await verifyProofOfInteraction(mockSupabase, "app-1", "user-1");

  assertExists(result);
  assertEquals((result as { verified: boolean }).verified, true);
  assertEquals((result as { can_rate: boolean }).can_rate, true);
  assertEquals((result as { can_comment: boolean }).can_comment, true);
  assertEquals((result as { interaction_count: number }).interaction_count, 1);
});

Deno.test("verifyProofOfInteraction returns verified=false when no cached proof", async () => {
  const mockSupabase = createMockSupabase({
    fromData: [],
  });

  const result = await verifyProofOfInteraction(mockSupabase, "app-1", "user-1");

  assertExists(result);
  assertEquals((result as { verified: boolean }).verified, false);
  assertEquals((result as { can_rate: boolean }).can_rate, false);
  assertEquals((result as { can_comment: boolean }).can_comment, false);
  assertEquals((result as { interaction_count: number }).interaction_count, 0);
});

Deno.test("verifyProofOfInteraction returns error Response on DB error", async () => {
  const mockSupabase = createMockSupabase({
    fromError: new Error("DB connection failed"),
  });

  const result = await verifyProofOfInteraction(mockSupabase, "app-1", "user-1");

  assertExists(result);
  assertEquals(result instanceof Response, true);
  assertEquals((result as Response).status, 500);
});

// -----------------------------------------------------------------------------
// checkSpamLimit Tests
// -----------------------------------------------------------------------------

Deno.test("checkSpamLimit returns true when within limits", async () => {
  const mockSupabase = createMockSupabase({
    rpcData: true,
  });

  const result = await checkSpamLimit(mockSupabase, "user-1", "comment");

  assertEquals(result, true);
});

Deno.test("checkSpamLimit returns 429 Response when rate limited", async () => {
  const mockSupabase = createMockSupabase({
    rpcData: false,
  });

  const result = await checkSpamLimit(mockSupabase, "user-1", "comment");

  assertExists(result);
  assertEquals(result instanceof Response, true);
  assertEquals((result as Response).status, 429);
});

Deno.test("checkSpamLimit returns 500 Response on RPC error", async () => {
  const mockSupabase = createMockSupabase({
    rpcError: new Error("RPC failed"),
  });

  const result = await checkSpamLimit(mockSupabase, "user-1", "comment");

  assertExists(result);
  assertEquals(result instanceof Response, true);
  assertEquals((result as Response).status, 500);
});

Deno.test("checkSpamLimit passes appId to RPC when provided", async () => {
  let capturedParams: Record<string, unknown> | null = null;
  const mockSupabase = {
    ...createMockSupabase({ rpcData: true }),
    rpc: (_fn: string, params: Record<string, unknown>) => {
      capturedParams = params;
      return Promise.resolve({ data: true, error: null });
    },
  } as unknown as Parameters<typeof checkSpamLimit>[0];

  await checkSpamLimit(mockSupabase, "user-1", "comment", "app-1");

  assertExists(capturedParams);
  assertEquals(capturedParams!.p_app_id, "app-1");
});

// -----------------------------------------------------------------------------
// logSpamAction Tests
// -----------------------------------------------------------------------------

Deno.test("logSpamAction calls RPC with correct parameters", async () => {
  let capturedFn: string | null = null;
  let capturedParams: Record<string, unknown> | null = null;

  const mockSupabase = {
    rpc: (fn: string, params: Record<string, unknown>) => {
      capturedFn = fn;
      capturedParams = params;
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as Parameters<typeof logSpamAction>[0];

  await logSpamAction(mockSupabase, "user-1", "comment", "app-1");

  assertEquals(capturedFn, "log_spam_action");
  assertExists(capturedParams);
  assertEquals(capturedParams!.p_user_id, "user-1");
  assertEquals(capturedParams!.p_action_type, "comment");
  assertEquals(capturedParams!.p_app_id, "app-1");
});

Deno.test("logSpamAction passes null appId when not provided", async () => {
  let capturedParams: Record<string, unknown> | null = null;

  const mockSupabase = {
    rpc: (_fn: string, params: Record<string, unknown>) => {
      capturedParams = params;
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as Parameters<typeof logSpamAction>[0];

  await logSpamAction(mockSupabase, "user-1", "vote");

  assertExists(capturedParams);
  assertEquals(capturedParams!.p_app_id, null);
});

// -----------------------------------------------------------------------------
// getCommentVoteCounts Tests
// -----------------------------------------------------------------------------

Deno.test("getCommentVoteCounts returns empty Map for empty input", async () => {
  const mockSupabase = createMockSupabase();

  const result = await getCommentVoteCounts(mockSupabase, []);

  assertEquals(result.size, 0);
});

Deno.test("getCommentVoteCounts counts upvotes and downvotes correctly", async () => {
  const mockSupabase = createMockSupabase({
    fromData: [
      { comment_id: "c1", vote_type: "upvote" },
      { comment_id: "c1", vote_type: "upvote" },
      { comment_id: "c1", vote_type: "downvote" },
      { comment_id: "c2", vote_type: "downvote" },
    ],
  });

  const result = await getCommentVoteCounts(mockSupabase, ["c1", "c2"]);

  assertEquals(result.size, 2);
  assertEquals(result.get("c1")?.upvotes, 2);
  assertEquals(result.get("c1")?.downvotes, 1);
  assertEquals(result.get("c2")?.upvotes, 0);
  assertEquals(result.get("c2")?.downvotes, 1);
});

Deno.test("getCommentVoteCounts returns empty Map on DB error", async () => {
  const mockSupabase = createMockSupabase({
    fromError: new Error("DB error"),
  });

  const result = await getCommentVoteCounts(mockSupabase, ["c1"]);

  assertEquals(result.size, 0);
});

Deno.test("getCommentVoteCounts initializes zero counts for comments without votes", async () => {
  const mockSupabase = createMockSupabase({
    fromData: [],
  });

  const result = await getCommentVoteCounts(mockSupabase, ["c1", "c2"]);

  assertEquals(result.size, 2);
  assertEquals(result.get("c1")?.upvotes, 0);
  assertEquals(result.get("c1")?.downvotes, 0);
});

// -----------------------------------------------------------------------------
// isDeveloperOfApp Tests
// -----------------------------------------------------------------------------

Deno.test("isDeveloperOfApp returns true when user is developer", async () => {
  const mockSupabase = createMockSupabase({
    singleData: { developer_user_id: "user-1" },
  });

  const result = await isDeveloperOfApp(mockSupabase, "user-1", "app-1");

  assertEquals(result, true);
});

Deno.test("isDeveloperOfApp returns false when user is not developer", async () => {
  const mockSupabase = createMockSupabase({
    singleData: { developer_user_id: "other-user" },
  });

  const result = await isDeveloperOfApp(mockSupabase, "user-1", "app-1");

  assertEquals(result, false);
});

Deno.test("isDeveloperOfApp returns false on DB error", async () => {
  const mockSupabase = createMockSupabase({
    singleError: new Error("Not found"),
  });

  const result = await isDeveloperOfApp(mockSupabase, "user-1", "app-1");

  assertEquals(result, false);
});

Deno.test("isDeveloperOfApp returns false when app not found", async () => {
  const mockSupabase = createMockSupabase({
    singleData: null,
  });

  const result = await isDeveloperOfApp(mockSupabase, "user-1", "app-1");

  assertEquals(result, false);
});
