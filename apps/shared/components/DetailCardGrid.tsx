import { useI18n } from "@shared/react";
import "./DetailCardGrid.scss";

export interface DetailCardGridItem {
  label: string;
  value: string | number;
}

export interface DetailCardGridProps {
  items: DetailCardGridItem[];
  columns?: 2 | 3;
  className?: string;
}

export function DetailCardGrid({ items, columns = 2, className }: DetailCardGridProps) {
  const { t } = useI18n();

  const classes = [
    "detail-grid",
    `detail-grid--cols-${columns}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} role="list" aria-label={t("detailsLabel")}>
      {items.map((item) => (
        <div key={item.label} className="detail-card" role="listitem" aria-label={`${item.label}: ${item.value}`}>
          <span className="detail-label">{item.label}</span>
          <span className="detail-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export default DetailCardGrid;
