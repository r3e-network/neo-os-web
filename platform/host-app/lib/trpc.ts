/**
 * tRPC Client Configuration
 *
 * Bypassing type inference issues by using explicit any type.
 * Type safety is maintained at the procedure level.
 */

import { createTRPCReact } from "@trpc/react-query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc: any = createTRPCReact();
