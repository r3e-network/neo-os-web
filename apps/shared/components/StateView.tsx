import type { ReactNode } from "react";
import { EmptyStateArt, ErrorArt } from "../components-react/illustrations";
import { Skeleton } from "./Skeleton";
import "./StateView.scss";

export type StateViewKind = "empty" | "loading" | "error";

export interface StateViewProps {
  /** Which placeholder state to render. */
  kind: StateViewKind;
  /**
   * Custom leading visual. When omitted, `empty`/`error` fall back to the
   * shared Neo Soft illustration and `loading` renders shimmer skeletons.
   * Pass `null` to suppress the default visual entirely.
   */
  icon?: ReactNode;
  /** Primary message. Required for `empty`/`error`; optional for `loading`. */
  title?: string;
  /** Secondary supporting line below the title. */
  hint?: string;
  /** Optional call-to-action (e.g. a NeoButton) rendered below the hint. */
  action?: ReactNode;
  className?: string;
}

/**
 * StateView — one shared, token-styled primitive for the empty / loading /
 * error placeholder states that today are reimplemented per app under 20+
 * bespoke class names. Reuses the shared illustration library for `empty`
 * and `error`, and the shared Skeleton shimmer for `loading`.
 *
 * Accessibility: the container is a live region. `loading` uses role="status"
 * + aria-busy so assistive tech announces progress without reading the
 * decorative shimmer; `error` uses role="alert"; `empty` uses role="status".
 */
export function StateView({
  kind,
  icon,
  title,
  hint,
  action,
  className,
}: StateViewProps) {
  const isLoading = kind === "loading";
  const isError = kind === "error";

  const role = isError ? "alert" : "status";

  const classes = ["ns-state-view", `ns-state-view--${kind}`, className]
    .filter(Boolean)
    .join(" ");

  let visual: ReactNode = icon;
  if (visual === undefined) {
    if (kind === "empty") {
      visual = <EmptyStateArt size={180} title={title || "Nothing here yet"} />;
    } else if (kind === "error") {
      visual = <ErrorArt size={104} title={title || "Something went wrong"} />;
    } else {
      visual = (
        <div className="ns-state-view__skeletons">
          <Skeleton shape="line" width="70%" />
          <Skeleton shape="line" width="90%" />
          <Skeleton shape="line" width="50%" />
        </div>
      );
    }
  }

  return (
    <div
      className={classes}
      role={role}
      aria-live={isError ? "assertive" : "polite"}
      aria-busy={isLoading || undefined}
    >
      {visual !== null && (
        <div className="ns-state-view__visual" aria-hidden={isLoading ? undefined : "true"}>
          {visual}
        </div>
      )}
      {title && <p className="ns-state-view__title">{title}</p>}
      {hint && <p className="ns-state-view__hint">{hint}</p>}
      {action && <div className="ns-state-view__action">{action}</div>}
    </div>
  );
}

export default StateView;
