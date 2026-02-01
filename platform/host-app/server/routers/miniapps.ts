/**
 * MiniApps Router - tRPC procedures for MiniApp operations
 */

import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { BUILTIN_APPS, getBuiltinApp } from "../../lib/builtin-apps";

export const miniappsRouter = router({
  // Get all miniapps
  list: publicProcedure.query(() => {
    return BUILTIN_APPS;
  }),

  // Get miniapps by category
  byCategory: publicProcedure.input(z.object({ category: z.string() })).query(({ input }) => {
    return BUILTIN_APPS.filter((app) => app.category === input.category);
  }),

  // Get single miniapp by ID
  byId: publicProcedure.input(z.object({ appId: z.string() })).query(({ input }) => {
    const app = getBuiltinApp(input.appId);
    if (!app) {
      return null;
    }
    return app;
  }),

  // Search miniapps
  search: publicProcedure.input(z.object({ query: z.string() })).query(({ input }) => {
    const q = input.query.toLowerCase();
    return BUILTIN_APPS.filter(
      (app) =>
        app.name.toLowerCase().includes(q) || app.name_zh?.includes(q) || app.description.toLowerCase().includes(q),
    );
  }),
});
