package monitoring

import (
	"fmt"
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/internal/metrics"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/process"
)

// MetricsCollector regularly collects and updates system metrics like memory usage, goroutines count, and other process stats. This should be a runnable service that the main app can start.
type MetricsCollector struct {
	cfg             *config.MonitoringConfig
	log             *logger.Logger
	collectInterval time.Duration
	startTime       time.Time
	shutdown        chan struct{}
	wg              sync.WaitGroup
	proc            *process.Process
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(cfg *config.MonitoringConfig, log *logger.Logger) (*MetricsCollector, error) {
	// Get the current process
	proc, err := process.NewProcess(int32(os.Getpid()))
	if err != nil {
		return nil, fmt.Errorf("failed to get current process: %w", err)
	}

	return &MetricsCollector{
		cfg:             cfg,
		log:             log,
		collectInterval: 15 * time.Second, // Default collection interval
		startTime:       time.Now(),
		shutdown:        make(chan struct{}),
		proc:            proc,
	}, nil
}

// Start begins collecting metrics
func (mc *MetricsCollector) Start() error {
	mc.log.Info("Metrics collector starting")

	// Initial collection to populate metrics
	mc.collectMetrics()

	// Start background collection
	mc.wg.Add(1)
	go func() {
		defer mc.wg.Done()
		ticker := time.NewTicker(mc.collectInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				mc.collectMetrics()
			case <-mc.shutdown:
				mc.log.Info("Metrics collector shutting down")
				return
			}
		}
	}()

	return nil
}

// Stop halts the metrics collection
func (mc *MetricsCollector) Stop() {
	close(mc.shutdown)
	mc.wg.Wait()
}

// collectMetrics gathers and updates all system and process metrics
func (mc *MetricsCollector) collectMetrics() {
	// Collect system metrics in parallel to reduce overall collection time
	wg := sync.WaitGroup{}
	wg.Add(5)

	// Memory stats
	go func() {
		defer wg.Done()
		mc.collectMemoryMetrics()
	}()

	// CPU stats
	go func() {
		defer wg.Done()
		mc.collectCPUMetrics()
	}()

	// Goroutine stats
	go func() {
		defer wg.Done()
		mc.collectGoroutineMetrics()
	}()

	// Disk stats
	go func() {
		defer wg.Done()
		mc.collectDiskMetrics()
	}()

	// Uptime
	go func() {
		defer wg.Done()
		mc.collectUptimeMetrics()
	}()

	// Wait for all collections to complete
	wg.Wait()
}

// collectMemoryMetrics gathers memory-related metrics
func (mc *MetricsCollector) collectMemoryMetrics() {
	// Go runtime memory stats
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// Update Go memory metrics
	metrics.MemoryUsage.Set(float64(memStats.Alloc))
	metrics.MemoryHeapAlloc.Set(float64(memStats.HeapAlloc))
	metrics.MemoryHeapSys.Set(float64(memStats.HeapSys))
	metrics.MemoryHeapObjects.Set(float64(memStats.HeapObjects))
	metrics.MemoryGCSys.Set(float64(memStats.GCSys))
	metrics.GCCount.Set(float64(memStats.NumGC))

	// System memory stats
	if systemMem, err := mem.VirtualMemory(); err == nil {
		metrics.SystemMemoryTotal.Set(float64(systemMem.Total))
		metrics.SystemMemoryUsed.Set(float64(systemMem.Used))
		metrics.SystemMemoryFree.Set(float64(systemMem.Free))
	} else {
		mc.log.Warnf("Failed to collect system memory metrics: %v", err)
	}

	// Process memory stats
	if proc, err := mc.proc.MemoryInfo(); err == nil {
		metrics.ProcessMemoryRSS.Set(float64(proc.RSS))
		metrics.ProcessMemoryVMS.Set(float64(proc.VMS))
	} else {
		mc.log.Warnf("Failed to collect process memory metrics: %v", err)
	}
}

// collectCPUMetrics gathers CPU-related metrics
func (mc *MetricsCollector) collectCPUMetrics() {
	// System CPU stats
	if cpuUtil, err := cpu.Percent(0, false); err == nil && len(cpuUtil) > 0 {
		metrics.SystemCPUUsage.Set(cpuUtil[0])
	} else if err != nil {
		mc.log.Warnf("Failed to collect system CPU metrics: %v", err)
	}

	// Process CPU stats
	if cpuUtil, err := mc.proc.CPUPercent(); err == nil {
		metrics.ProcessCPUUsage.Set(cpuUtil)
	} else {
		mc.log.Warnf("Failed to collect process CPU metrics: %v", err)
	}
}

// collectGoroutineMetrics gathers goroutine-related metrics
func (mc *MetricsCollector) collectGoroutineMetrics() {
	metrics.GoroutinesCount.Set(float64(runtime.NumGoroutine()))
}

// collectDiskMetrics gathers disk-related metrics
func (mc *MetricsCollector) collectDiskMetrics() {
	// Get current working directory to check its disk
	cwd, err := os.Getwd()
	if err != nil {
		mc.log.Warnf("Failed to get current working directory: %v", err)
		return
	}

	// Get disk usage statistics
	diskUsage, err := disk.Usage(cwd)
	if err != nil {
		mc.log.Warnf("Failed to get disk usage: %v", err)
		return
	}

	metrics.DiskTotal.Set(float64(diskUsage.Total))
	metrics.DiskUsed.Set(float64(diskUsage.Used))
	metrics.DiskFree.Set(float64(diskUsage.Free))
	metrics.DiskUsagePercent.Set(diskUsage.UsedPercent)
}

// collectUptimeMetrics updates service uptime metrics
func (mc *MetricsCollector) collectUptimeMetrics() {
	uptime := time.Since(mc.startTime).Seconds()
	metrics.ServiceUptimeSeconds.Set(uptime)
}
