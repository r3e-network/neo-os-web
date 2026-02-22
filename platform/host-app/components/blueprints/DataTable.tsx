import React, { useState, useMemo, useCallback, memo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { usePerformanceMonitor } from "./usePerformanceMonitor";

/**
 * Data Table Component - Optimized with Virtual Scroll
 * Configurable table for displaying data
 */

export type TableColumn<T = unknown> = {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
};

export type TableConfig = {
  columns: TableColumn[];
  data: unknown[];
  sortable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  rowKey?: string;
  virtualScroll?: boolean;
  virtualScrollHeight?: number;
};

type DataTableProps<T = unknown> = {
  config: TableConfig;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
};

// 虚拟滚动配置
const VIRTUAL_SCROLL_ITEM_HEIGHT = 48; // 行高
const VIRTUAL_SCROLL_OVERSCAN = 5; // 预渲染行数

/**
 * 表格行组件 - 使用 memo 优化
 */
interface TableRowProps<T> {
  row: T;
  rowIndex: number;
  columns: TableColumn<T>[];
  rowKey?: string;
  onRowClick?: (row: T, index: number) => void;
}

const TableRow = memo(<T extends Record<string, unknown>>({ 
  row, 
  rowIndex, 
  columns, 
  rowKey, 
  onRowClick 
}: TableRowProps<T>) => {
  const handleClick = useCallback(() => {
    onRowClick?.(row, rowIndex);
  }, [onRowClick, row, rowIndex]);

  const getCellValue = useCallback((col: TableColumn<T>, index: number) => {
    const value = row[col.key as keyof T];
    if (col.render) {
      return col.render(value, row, index);
    }
    return String(value ?? "-");
  }, [row]);

  const key = rowKey ? row[rowKey as keyof T] as string : rowIndex;

  return (
    <tr
      key={key}
      className={cn(
        "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
        onRowClick && "cursor-pointer"
      )}
      onClick={handleClick}
    >
      {columns.map((col, colIndex) => (
        <td
          key={col.key}
          className={cn(
            "px-4 py-3 text-sm",
            col.align === "center" && "text-center",
            col.align === "right" && "text-right"
          )}
        >
          {getCellValue(col, rowIndex)}
        </td>
      ))}
    </tr>
  );
});

TableRow.displayName = "TableRow";

/**
 * 表头组件 - 使用 memo 优化
 */
interface TableHeaderProps<T> {
  columns: TableColumn<T>[];
  sortKey: string | null;
  sortOrder: "asc" | "desc";
  onSort: (key: string) => void;
  sortable: boolean;
}

const TableHeader = memo(<T extends Record<string, unknown>>({ 
  columns, 
  sortKey, 
  sortOrder, 
  onSort,
  sortable 
}: TableHeaderProps<T>) => (
  <thead className="bg-gray-50 dark:bg-gray-800/50">
    <tr>
      {columns.map((col) => (
        <th
          key={col.key}
          className={cn(
            "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400",
            col.align === "center" && "text-center",
            col.align === "right" && "text-right",
            sortable && col.sortable && "cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
          )}
          style={{ width: col.width }}
          onClick={() => sortable && col.sortable && onSort(col.key)}
        >
          <div className={cn("flex items-center gap-1", col.align === "right" && "justify-end", col.align === "center" && "justify-center")}>
            {col.label}
            {sortable && col.sortable && sortKey === col.key && (
              <span className="text-neo">{sortOrder === "asc" ? "↑" : "↓"}</span>
            )}
          </div>
        </th>
      ))}
    </tr>
  </thead>
));

TableHeader.displayName = "TableHeader";

/**
 * 分页组件 - 使用 memo 优化
 */
interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

const Pagination = memo<PaginationProps>(({ 
  page, 
  totalPages, 
  pageSize, 
  totalItems,
  onPageChange 
}) => {
  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <span className="text-xs text-gray-500">
        Showing {start} to {end} of {totalItems}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
});

Pagination.displayName = "Pagination";

/**
 * 虚拟滚动容器
 */
interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  height: number;
  itemHeight: number;
  overscan?: number;
}

function VirtualList<T>({ items, renderItem, height, itemHeight, overscan = 5 }: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + height) / itemHeight) + overscan
  );

  const visibleItems = useMemo(() => {
    const result: { item: T; index: number }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      result.push({ item: items[i], index: i });
    }
    return result;
  }, [items, startIndex, endIndex]);

  return (
    <div
      ref={containerRef}
      className="overflow-auto"
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map(({ item, index }) => (
          <div
            key={index}
            style={{
              position: "absolute",
              top: index * itemHeight,
              height: itemHeight,
              width: "100%",
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * DataTable 主组件 - 优化版本
 */
export function DataTable<T extends Record<string, unknown>>({
  config,
  onRowClick,
  className,
}: DataTableProps<T>) {
  // 性能监控
  usePerformanceMonitor("DataTable");

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const pageSize = config.pageSize || 10;
  const columns = config.columns;
  const data = config.data as T[];

  // 使用 useMemo 缓存排序后的数据
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      const comparison = aVal < bVal ? -1 : 1;
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [data, sortKey, sortOrder]);

  // 使用 useMemo 缓存分页后的数据
  const paginatedData = useMemo(() => {
    if (!config.pagination) return sortedData;
    const start = page * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize, config.pagination]);

  // 使用 useMemo 缓存总页数
  const totalPages = useMemo(
    () => Math.ceil(sortedData.length / pageSize),
    [sortedData.length, pageSize]
  );

  // 使用 useCallback 缓存排序处理函数
  const handleSort = useCallback((key: string) => {
    if (!config.sortable) return;
    if (sortKey === key) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  }, [config.sortable, sortKey]);

  // 使用 useCallback 缓存分页处理函数
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // 当数据变化时重置页码
  useEffect(() => {
    setPage(0);
  }, [data.length]);

  if (data.length === 0) {
    return (
      <div className={cn("text-center py-8 text-gray-500", className)}>
        {config.emptyMessage || "No data available"}
      </div>
    );
  }

  const isVirtualScrollEnabled = config.virtualScroll && data.length > 100;
  const virtualScrollHeight = config.virtualScrollHeight || 400;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700", className)}>
      {isVirtualScrollEnabled ? (
        // 虚拟滚动模式
        <div className="flex flex-col h-full">
          <TableHeader
            columns={columns}
            sortKey={sortKey}
            sortOrder={sortOrder}
            onSort={handleSort}
            sortable={config.sortable ?? false}
          />
          <div className="flex-1 min-h-0">
            <VirtualList
              items={sortedData}
              renderItem={(row, rowIndex) => (
                <TableRow
                  row={row}
                  rowIndex={rowIndex}
                  columns={columns}
                  rowKey={config.rowKey}
                  onRowClick={onRowClick}
                />
              )}
              height={virtualScrollHeight}
              itemHeight={VIRTUAL_SCROLL_ITEM_HEIGHT}
              overscan={VIRTUAL_SCROLL_OVERSCAN}
            />
          </div>
        </div>
      ) : (
        // 普通模式
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <TableHeader
                columns={columns}
                sortKey={sortKey}
                sortOrder={sortOrder}
                onSort={handleSort}
                sortable={config.sortable ?? false}
              />
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedData.map((row, rowIndex) => (
                  <TableRow
                    key={config.rowKey ? row[config.rowKey as keyof T] as string : rowIndex}
                    row={row}
                    rowIndex={rowIndex}
                    columns={columns}
                    rowKey={config.rowKey}
                    onRowClick={onRowClick}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {config.pagination && totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={sortedData.length}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}
