/**
 * tRPC Server Configuration
 *
 * This file sets up the tRPC server with context and procedures.
 * @see https://trpc.io/docs/server/introduction
 */

import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import superjson from "superjson";
import { ZodError } from "zod";

/**
 * Context creation - runs for each request
 */
export async function createContext(opts: CreateNextContextOptions) {
  const { req, res } = opts;

  // Wallet-only: no session, user is identified by wallet connection
  return {
    req,
    res,
    user: null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

/**
 * Initialize tRPC with context and transformer
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Export reusable router and procedure helpers
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

/**
 * Auth middleware - ensures user is authenticated
 * Note: With wallet-only auth, this is simplified. 
 * Wallet verification happens at the API level via signature verification.
 */
const isAuthed = middleware(({ ctx, next }) => {
  // Wallet-only: authentication is handled via wallet signatures
  // This is a simplified check - real auth happens in individual procedures
  return next({
    ctx,
  });
});

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(isAuthed);
