import React, { useMemo, memo, useCallback, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { usePerformanceMonitor } from "./usePerformanceMonitor";

/**
 * Dynamic Component Registry - Optimized
 * Allows registration and rendering of components based on configuration
 */

export type ComponentConfig = {
  type: string;
  props?: Record<string, unknown>;
  condition?: ConditionConfig;
  children?: ComponentConfig[];
};

export type ConditionConfig = {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value: unknown;
};

export type DataBinding = {
  source: "props" | "state" | "contract" | "api" | "static";
  path: string;
  transform?: string;
  defaultValue?: unknown;
};

export type ComponentRegistry = Record<string, {
  component: React.ComponentType<any>;
  defaultProps?: Record<string, unknown>;
  schema?: Record<string, unknown>;
}>;

/**
 * Built-in component types
 */
export const BUILT_IN_COMPONENTS = {
  "layout.container": { component: null },
  "layout.grid": { component: null },
  "layout.flex": { component: null },
  "layout.stack": { component: null },
  "layout.card": { component: null },
  "layout.section": { component: null },
  
  "display.text": { component: null },
  "display.heading": { component: null },
  "display.image": { component: null },
  "display.badge": { component: null },
  "display.avatar": { component: null },
  "display.progress": { component: null },
  "display.chart": { component: null },
  
  "input.text": { component: null },
  "input.number": { component: null },
  "input.select": { component: null },
  "input.checkbox": { component: null },
  "input.radio": { component: null },
  "input.date": { component: null },
  
  "data.list": { component: null },
  "data.table": { component: null },
  "data.grid": { component: null },
  "data.pagination": { component: null },
  "data.filter": { component: null },
  "data.sort": { component: null },
  
  "action.button": { component: null },
  "action.link": { component: null },
  "action.form": { component: null },
  "action.modal": { component: null },
  "action.drawer": { component: null },
  
  "feedback.alert": { component: null },
  "feedback.toast": { component: null },
  "feedback.spinner": { component: null },
  "feedback.skeleton": { component: null },
  "feedback.empty": { component: null },
  
  "miniapp.operation": { component: null },
  "miniapp.market": { component: null },
  "miniapp.stats": { component: null },
  "miniapp.leaderboard": { component: null },
  "miniapp.timeline": { component: null },
  "miniapp.comments": { component: null },
  "miniapp.reviews": { component: null },
} as const;

export type BuiltInComponentType = keyof typeof BUILT_IN_COMPONENTS;

type ComponentRendererProps = {
  config: ComponentConfig;
  registry: ComponentRegistry;
  data?: Record<string, unknown>;
  onAction?: (action: string, payload?: unknown) => void;
  children?: (components: React.ReactNode) => React.ReactNode;
};

// 条件操作符缓存
const OPERATORS: Record<string, (a: unknown, b: unknown) => boolean> = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  gt: (a, b) => typeof a === "number" && a > (b as number),
  gte: (a, b) => typeof a === "number" && a >= (b as number),
  lt: (a, b) => typeof a === "number" && a < (b as number),
  lte: (a, b) => typeof a === "number" && a <= (b as number),
  in: (a, b) => Array.isArray(b) && b.includes(a),
  contains: (a, b) => typeof a === "string" && a.includes(b as string),
};

export function evaluateCondition(
  condition: ConditionConfig | undefined,
  data: Record<string, unknown>
): boolean {
  if (!condition) return true;

  const value = getNestedValue(data, condition.field);
  const operator = OPERATORS[condition.operator];
  
  if (!operator) return true;
  
  return operator(value, condition.value);
}

const valueCache = new Map<string, unknown>();
const CACHE_MAX_SIZE = 500;

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const cacheKey = `${JSON.stringify(obj)}::${path}`;
  
  const cached = valueCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  
  const keys = path.split(".");
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  
  if (valueCache.size >= CACHE_MAX_SIZE) {
    valueCache.clear();
  }
  valueCache.set(cacheKey, current);
  
  return current;
}

export function transformData(
  data: unknown,
  transform?: string
): unknown {
  if (!transform) return data;
  
  switch (transform) {
    case "number":
      return typeof data === "number" ? data : Number(data);
    case "string":
      return String(data);
    case "boolean":
      return Boolean(data);
    case "json":
      return typeof data === "string" ? JSON.parse(data) : data;
    case "array":
      return Array.isArray(data) ? data : [data];
    case "uppercase":
      return typeof data === "string" ? data.toUpperCase() : data;
    case "lowercase":
      return typeof data === "string" ? data.toLowerCase() : data;
    case "capitalize":
      return typeof data === "string" 
        ? data.charAt(0).toUpperCase() + data.slice(1).toLowerCase() 
        : data;
    case "formatNumber":
      return typeof data === "number" 
        ? data.toLocaleString() 
        : data;
    case "formatCurrency":
      return typeof data === "number"
        ? `$${data.toLocaleString()}`
        : data;
    case "formatPercent":
      return typeof data === "number"
        ? `${(data * 100).toFixed(1)}%`
        : data;
    default:
      return data;
  }
}

export function resolveDataBinding(
  binding: DataBinding,
  context: {
    props: Record<string, unknown>;
    state: Record<string, unknown>;
    contractData?: Record<string, unknown>;
    apiData?: Record<string, unknown>;
  }
): unknown {
  let sourceData: Record<string, unknown> = {};
  
  switch (binding.source) {
    case "props":
      sourceData = context.props;
      break;
    case "state":
      sourceData = context.state;
      break;
    case "contract":
      sourceData = context.contractData || {};
      break;
    case "api":
      sourceData = context.apiData || {};
      break;
    case "static":
      return binding.defaultValue;
  }
  
  const value = getNestedValue(sourceData, binding.path);
  return transformData(value ?? binding.defaultValue, binding.transform);
}

// Badge variants
const BADGE_VARIANTS: Record<string, string> = {
  default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

// Alert variants
const ALERT_VARIANTS: Record<string, string> = {
  info: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  danger: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800",
};

// Spinner sizes
const SPINNER_SIZES: Record<string, string> = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export function createDefaultRegistry(): ComponentRegistry {
  return {
    "layout.container": {
      component: memo(({ children, className }: { children?: React.ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
      )),
      defaultProps: { className: "" },
    },
    "layout.card": {
      component: memo(({ children, className, title }: { children?: React.ReactNode; className?: string; title?: string }) => (
        <div className={cn("rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900", className)}>
          {title && <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold">{title}</div>}
          <div className="p-4">{children}</div>
        </div>
      )),
    },
    "layout.section": {
      component: memo(({ children, title, className }: { children?: React.ReactNode; title?: string; className?: string }) => (
        <section className={className}>
          {title && <h2 className="text-lg font-semibold mb-4">{title}</h2>}
          {children}
        </section>
      )),
    },
    
    "display.heading": {
      component: memo(({ text, level = 2, className }: { text?: string; level?: number; className?: string }) => {
        const Tag = `h${level}` as keyof JSX.IntrinsicElements;
        return <Tag className={className}>{text}</Tag>;
      }),
      defaultProps: { level: 2, text: "" },
    },
    "display.text": {
      component: memo(({ text, className, color }: { text?: string; className?: string; color?: string }) => (
        <p className={className} style={{ color }}>{text}</p>
      )),
    },
    "display.badge": {
      component: memo(({ text, variant = "default", className }: { text?: string; variant?: string; className?: string }) => (
        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", BADGE_VARIANTS[variant] || BADGE_VARIANTS.default, className)}>
          {text}
        </span>
      )),
    },
    "display.progress": {
      component: memo(({ value, max = 100, className, showLabel }: { value?: number; max?: number; className?: string; showLabel?: boolean }) => {
        const percent = Math.min(100, Math.max(0, ((value || 0) / max) * 100));
        return (
          <div className={className}>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-neo transition-all" style={{ width: `${percent}%` }} />
            </div>
            {showLabel && <span className="text-xs text-gray-500 mt-1">{percent.toFixed(0)}%</span>}
          </div>
        );
      }),
    },
    
    "feedback.spinner": {
      component: memo(({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) => (
        <div className={cn(SPINNER_SIZES[size] || SPINNER_SIZES.md, "animate-spin rounded-full border-2 border-gray-300 border-t-neo", className)} />
      )),
    },
    "feedback.empty": {
      component: memo(({ message = "No data", className }: { message?: string; className?: string }) => (
        <div className={cn("text-center py-8 text-gray-500", className)}>
          <p>{message}</p>
        </div>
      )),
    },
    "feedback.alert": {
      component: memo(({ message, variant = "info", className }: { message?: string; variant?: string; className?: string }) => (
        <div className={cn("p-4 rounded-lg border", ALERT_VARIANTS[variant] || ALERT_VARIANTS.info, className)}>
          {message}
        </div>
      )),
    },
  };
}

const ComponentRenderer = memo<ComponentRendererProps>(({
  config,
  registry,
  data = {},
  onAction,
}) => {
  const shouldRender = useMemo(
    () => evaluateCondition(config.condition, data),
    [config.condition, data]
  );

  if (!shouldRender) {
    return null;
  }

  const Component = registry[config.type]?.component;
  
  if (!Component) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`Component type "${config.type}" not found in registry`);
    }
    return null;
  }

  const defaultProps = registry[config.type]?.defaultProps || {};
  const props = { ...defaultProps, ...config.props };

  return <Component {...props} onAction={onAction} />;
});

ComponentRenderer.displayName = "ComponentRenderer";

interface RenderComponentTreeProps {
  configs: ComponentConfig[];
  registry: ComponentRegistry;
  data: Record<string, unknown>;
  onAction?: (action: string, payload?: unknown) => void;
}

export const RenderComponentTree = memo(function RenderComponentTree({
  configs,
  registry,
  data,
  onAction,
}: RenderComponentTreeProps) {
  const renderedComponents = useMemo(
    () => configs.map((config, index) => (
      <ComponentRenderer
        key={`${config.type}-${index}`}
        config={config}
        registry={registry}
        data={data}
        onAction={onAction}
      >
        {config.children && config.children.length > 0 ? (
          () => (
            <RenderComponentTree
              configs={config.children || []}
              registry={registry}
              data={data}
              onAction={onAction}
            />
          )
        ) : undefined}
      </ComponentRenderer>
    )),
    [configs, registry, data, onAction]
  );

  return <>{renderedComponents}</>;
});

export function lazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn);
  
  return function WrappedComponent(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback || <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
