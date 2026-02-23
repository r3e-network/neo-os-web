describe("initPerformanceMonitoring", () => {
  beforeEach(() => {
    jest.resetModules();
    delete (window as Window & { webVitals?: unknown }).webVitals;
  });

  it("wires callbacks when window.webVitals is available", async () => {
    const getCLS = jest.fn();
    const getFID = jest.fn();
    const getLCP = jest.fn();
    (window as Window & { webVitals?: unknown }).webVitals = { getCLS, getFID, getLCP };

    const mod = await import("../../lib/monitoring/performance");
    mod.initPerformanceMonitoring();

    expect(getCLS).toHaveBeenCalledWith(expect.any(Function));
    expect(getFID).toHaveBeenCalledWith(expect.any(Function));
    expect(getLCP).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does not throw when window.webVitals is missing", async () => {
    const mod = await import("../../lib/monitoring/performance");
    expect(() => mod.initPerformanceMonitoring()).not.toThrow();
  });
});
