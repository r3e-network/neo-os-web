/**
 * @jest-environment node
 */
import {
  createLogger,
  generateTraceId,
  generateSpanId,
  setTraceContext,
  getTraceContext,
  clearTraceContext,
} from "@/lib/observability/logger";

describe("Logger", () => {
  beforeEach(() => {
    clearTraceContext();
  });

  describe("createLogger", () => {
    it("creates a logger with name", () => {
      const logger = createLogger("test");
      expect(logger).toBeDefined();
    });
  });

  describe("generateTraceId", () => {
    it("generates unique trace IDs", () => {
      const id1 = generateTraceId();
      const id2 = generateTraceId();
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });
  });

  describe("generateSpanId", () => {
    it("generates unique span IDs", () => {
      const id1 = generateSpanId();
      const id2 = generateSpanId();
      expect(id1).toBeTruthy();
      expect(id1).not.toBe(id2);
    });
  });

  describe("trace context", () => {
    it("sets and gets trace context", () => {
      setTraceContext("trace-123", "span-456");
      const ctx = getTraceContext();
      expect(ctx.traceId).toBe("trace-123");
      expect(ctx.spanId).toBe("span-456");
    });

    it("clears trace context", () => {
      setTraceContext("trace-123");
      clearTraceContext();
      const ctx = getTraceContext();
      expect(ctx.traceId).toBeUndefined();
    });
  });
});
