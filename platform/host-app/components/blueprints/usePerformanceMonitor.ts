/**
 * Performance Monitor Hook
 * 用于追踪组件渲染性能和用户交互
 */

import { useEffect, useRef, useCallback } from "react";

export type PerformanceMetrics = {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  componentName: string;
};

export type PerformanceMark = {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
};

// 全局性能标记存储
const globalMarks = new Map<string, PerformanceMark[]>();

/**
 * 性能监控 Hook
 */
export function usePerformanceMonitor(componentName: string) {
  const metricsRef = useRef<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    componentName,
  });

  const markRef = useRef<PerformanceMark[]>([]);

  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      metricsRef.current.renderCount++;
      metricsRef.current.lastRenderTime = duration;
      metricsRef.current.averageRenderTime = 
        (metricsRef.current.averageRenderTime * (metricsRef.current.renderCount - 1) + duration) / 
        metricsRef.current.renderCount;
    };
  });

  const mark = useCallback((name: string, startMark?: string) => {
    const marks = markRef.current;
    const existingMark = marks.find(m => m.name === startMark);
    
    if (existingMark && !existingMark.endTime) {
      existingMark.endTime = performance.now();
      existingMark.duration = existingMark.endTime - existingMark.startTime;
    } else {
      marks.push({
        name,
        startTime: performance.now(),
      });
    }
  }, []);

  const getMarks = useCallback((name: string) => {
    return markRef.current.filter(m => m.name.startsWith(name));
  }, []);

  const logMetrics = useCallback(() => {
    if (process.env.NODE_ENV === "development") {
      const metrics = metricsRef.current;
      console.log(`[Performance] ${componentName}:`, {
        renderCount: metrics.renderCount,
        avgRenderTime: `${metrics.averageRenderTime.toFixed(2)}ms`,
        lastRenderTime: `${metrics.lastRenderTime.toFixed(2)}ms`,
      });
    }
  }, [componentName]);

  return {
    metrics: metricsRef.current,
    mark,
    getMarks,
    logMetrics,
  };
}

/**
 * 全局性能标记
 */
export function createMark(name: string) {
  const timestamp = performance.now();
  const key = `${name}-${timestamp}`;
  
  const marks = globalMarks.get(name) || [];
  marks.push({ name: key, startTime: timestamp });
  globalMarks.set(name, marks);
  
  return () => {
    const marks = globalMarks.get(name);
    if (marks) {
      const mark = marks.find(m => m.name === key);
      if (mark) {
        mark.endTime = performance.now();
        mark.duration = mark.endTime - mark.startTime;
      }
    }
  };
}

/**
 * 测量函数执行时间
 */
export function measureAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  label: string
): T {
  return ((...args: unknown[]) => {
    const start = performance.now();
    return fn(...args).finally(() => {
      const duration = performance.now() - start;
      if (process.env.NODE_ENV === "development") {
        console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
      }
    }) as ReturnType<T>;
  }) as unknown as T;
}

/**
 * 防抖 Hook
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 节流 Hook
 */
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = React.useState(value);
  const lastUpdated = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdated.current >= interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timerId = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - (now - lastUpdated.current));

      return () => clearTimeout(timerId);
    }
  }, [value, interval]);

  return throttledValue;
}

import * as React from "react";
