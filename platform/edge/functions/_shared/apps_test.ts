import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { isAppOwnerOrAdmin } from "./apps.ts";

function createMockSupabase(overrides: {
  appOwnerId?: string | null;
  isAdmin?: boolean;
} = {}) {
  return {
    from: (table: string) => {
      if (table === "miniapps") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: overrides.appOwnerId ? { developer_user_id: overrides.appOwnerId } : null,
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "admin_emails") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: overrides.isAdmin ? { user_id: "admin" } : null,
                  error: null,
                }),
            }),
          }),
        };
      }
      return {
        select: (_cols: string) => ({
          eq: (_col: string, _val: string) => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
  } as unknown as Parameters<typeof isAppOwnerOrAdmin>[0];
}

Deno.test("isAppOwnerOrAdmin returns false when user is not owner or admin", async () => {
  const supabase = createMockSupabase({ appOwnerId: "owner", isAdmin: false });
  const result = await isAppOwnerOrAdmin(supabase, "app-1", "user-1");
  assertEquals(result, false);
});
