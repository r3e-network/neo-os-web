import { createOSHandler } from "../_shared/os-service.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const handler = createOSHandler(
  { scopeName: "os-vesting-list", permission: "vesting", cacheable: true },
  async ({ params }) => {
    let limit = Number(params.limit ?? DEFAULT_LIMIT);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    return [] as unknown[];
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
