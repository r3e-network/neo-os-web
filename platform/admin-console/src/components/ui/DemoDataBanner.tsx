// =============================================================================
// DemoDataBanner Component - Demo/mock data indicator
// =============================================================================
//
// Rendered by pages whose backing API route answered with the
// `X-Mock-Data: true` header, i.e. the data on screen is read-only sample
// data and edits are rejected with 501 by the route.

import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const MOCK_DATA_HEADER = "X-Mock-Data";

/** True when an API response declared its payload as demo/mock data. */
export function isMockDataResponse(response: Pick<Response, "headers">): boolean {
  return response.headers.get(MOCK_DATA_HEADER) === "true";
}

export const DemoDataBanner = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    role="status"
    data-testid="demo-data-banner"
    className={cn(
      "rounded-xl border border-amber-200 bg-amber-50 p-4",
      className,
    )}
    {...props}
  >
    <p className="text-sm font-semibold text-amber-800">
      Demo data — this page shows read-only sample data; changes are not
      persisted.
    </p>
    {children}
  </div>
));

DemoDataBanner.displayName = "DemoDataBanner";
