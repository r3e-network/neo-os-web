/**
 * tRPC API Handler for Next.js
 */

import { createNextApiHandler } from "@trpc/server/adapters/next";
import { appRouter } from "../../../server/root";
import { createContext } from "../../../server/trpc";
import { logger } from "@/lib/logger";

export default createNextApiHandler({
  router: appRouter,
  createContext,
  onError({ error, path }) {
    logger.error(`tRPC error on '${path}'`, error);
  },
});
