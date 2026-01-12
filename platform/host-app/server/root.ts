/**
 * tRPC App Router - combines all routers
 */

import { router } from "./trpc";
import { miniappsRouter } from "./routers/miniapps";
import { healthRouter } from "./routers/health";

export const appRouter = router({
  miniapps: miniappsRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
