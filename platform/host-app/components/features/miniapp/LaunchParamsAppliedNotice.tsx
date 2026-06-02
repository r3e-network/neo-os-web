import type { MiniAppLaunchContext } from "../../../lib/miniapp-launch-params";

export function LaunchParamsAppliedNotice({
  launchContext,
  className = "mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800",
  testId,
}: {
  launchContext: MiniAppLaunchContext;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={className} data-testid={testId}>
      <p className="m-0 font-semibold">Workspace parameters applied</p>
      <p className="m-0">
        No transaction was sent by this parameter update.
      </p>
      <p className="m-0 break-words">
        Source: {launchContext.source}
        {launchContext.operation
          ? ` · Operation: ${launchContext.operation}`
          : ""}
        {launchContext.keys.length > 0
          ? ` · Fields: ${launchContext.keys.join(", ")}`
          : ""}
      </p>
    </div>
  );
}
