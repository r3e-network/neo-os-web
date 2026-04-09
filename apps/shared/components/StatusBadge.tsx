import "./StatusBadge.scss";

export type BadgeStatus = "ready" | "active" | "success" | "warning" | "error" | "inactive" | "pending";

export interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
  /** Whether the dot should pulse (useful for 'ready' or 'active' states) */
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, label, pulse = false, className }: StatusBadgeProps) {
  const classes = [
    "status-badge",
    `status-badge--${status}`,
    pulse && "status-badge--pulse",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} role="status" aria-label={label || status}>
      <div className="status-badge__dot" aria-hidden="true" />
      <span className="status-badge__label">{label || status}</span>
    </div>
  );
}

export default StatusBadge;
