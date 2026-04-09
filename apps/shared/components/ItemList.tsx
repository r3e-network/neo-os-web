import { useMemo, type ReactNode } from "react";
import { useI18n } from "@shared/react";
import "./ItemList.scss";

export interface ItemListProps {
  items: Array<Record<string, unknown>>;
  loading?: boolean;
  loadingText?: string;
  emptyText?: string;
  /** Key field on item objects for :key binding */
  itemKey?: string;
  scrollable?: boolean;
  /** Max height in px (enables overflow scroll automatically) */
  maxHeight?: number;
  /** Number of items to display (for client-side pagination). 0 = show all. */
  limit?: number;
  /** Whether more items can be loaded (shows load-more button) */
  hasMore?: boolean;
  /** Label for the load-more button */
  loadMoreText?: string;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** Label for the empty-state action button (shows button when provided) */
  emptyActionLabel?: string;
  className?: string;
  /** Render function for each item */
  renderItem?: (item: Record<string, unknown>, index: number) => ReactNode;
  /** Custom empty state content */
  renderEmpty?: () => ReactNode;
  onLoadMore?: () => void;
  onEmptyAction?: () => void;
}

export function ItemList({
  items,
  loading = false,
  loadingText,
  emptyText,
  itemKey,
  scrollable = false,
  maxHeight,
  limit = 0,
  hasMore = false,
  loadMoreText,
  ariaLabel,
  emptyActionLabel,
  className,
  renderItem,
  renderEmpty,
  onLoadMore,
  onEmptyAction,
}: ItemListProps) {
  const { t } = useI18n();

  const displayedItems = useMemo(() => {
    if (limit > 0) return items.slice(0, limit);
    return items;
  }, [items, limit]);

  const classes = ["item-list", className].filter(Boolean).join(" ");

  if (loading) {
    return (
      <div className={classes} role="list" aria-label={ariaLabel || t("listLabel")}>
        <div className="item-list__loading" role="status" aria-label={t("loading")}>
          <div className="item-list__spinner" aria-hidden="true" />
          {loadingText && <span className="item-list__loading-text">{loadingText}</span>}
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className={classes} role="list" aria-label={ariaLabel || t("listLabel")}>
        <div className="item-list__empty" role="status">
          {renderEmpty ? (
            renderEmpty()
          ) : (
            <>
              <span className="item-list__empty-text">{emptyText ?? t("emptyStateHint")}</span>
              {emptyActionLabel && (
                <button type="button" className="item-list__empty-action" onClick={onEmptyAction}>
                  {emptyActionLabel ?? t("getStarted")}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={classes} role="list" aria-label={ariaLabel || t("listLabel")}>
      <div
        className={[
          "item-list__content",
          scrollable && "item-list__content--scrollable",
        ]
          .filter(Boolean)
          .join(" ")}
        style={maxHeight ? { maxHeight: `${maxHeight}px` } : undefined}
      >
        {displayedItems.map((item, index) => {
          const key = itemKey ? String(item[itemKey]) : String(item.id ?? index);
          return (
            <div key={key} className="item-list__item" role="listitem">
              {renderItem?.(item, index)}
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          className="item-list__load-more"
          disabled={loading}
          aria-disabled={loading}
          onClick={onLoadMore}
        >
          <span>{loadMoreText ?? t("loadMore")}</span>
        </button>
      )}
    </div>
  );
}

export default ItemList;
