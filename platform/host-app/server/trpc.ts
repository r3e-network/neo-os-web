/**
 * tRPC Server Configuration
 *
 * This file sets up the tRPC server with context and procedures.
 * @see https://trpc.io/docs/server/introduction
 */

import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import { getSession } from "@auth0/nextjs-auth0";
import superjson from "superjson";
import { ZodError } from "zod";

/**
 * Context creation - runs for each request
 */
export async function createContext(opts: CreateNextContextOptions) {
  const { req, res } = opts;

  // Get Auth0 session (may be null for public routes)
  const session = await getSession(req, res);

  return {
    req,
    res,
    session,
    user: session?.user ?? null,
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
 */
const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(isAuthed);
