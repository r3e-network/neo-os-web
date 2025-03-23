package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

// System memory metrics
var (
	// Memory heap metrics
	MemoryHeapAlloc = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_memory_heap_alloc_bytes",
		Help: "Current heap memory allocation in bytes",
	})

	MemoryHeapSys = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_memory_heap_sys_bytes",
		Help: "Current heap memory reserved by the system in bytes",
	})

	MemoryHeapObjects = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_memory_heap_objects",
		Help: "Current number of allocated heap objects",
	})

	MemoryGCSys = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_memory_gc_sys_bytes",
		Help: "Memory used by the garbage collector in bytes",
	})

	GCCount = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_gc_count",
		Help: "Number of completed garbage collection cycles",
	})

	// System memory metrics
	SystemMemoryTotal = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_system_memory_total_bytes",
		Help: "Total system memory in bytes",
	})

	SystemMemoryUsed = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_system_memory_used_bytes",
		Help: "Used system memory in bytes",
	})

	SystemMemoryFree = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_system_memory_free_bytes",
		Help: "Free system memory in bytes",
	})

	// Process memory metrics
	ProcessMemoryRSS = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_process_memory_rss_bytes",
		Help: "Resident set size (RSS) of the process in bytes",
	})

	ProcessMemoryVMS = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_process_memory_vms_bytes",
		Help: "Virtual memory size of the process in bytes",
	})
)

// CPU metrics
var (
	// System CPU metrics
	SystemCPUUsage = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_system_cpu_usage_percent",
		Help: "System CPU usage percentage (0-100)",
	})

	// Process CPU metrics
	ProcessCPUUsage = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_process_cpu_usage_percent",
		Help: "Process CPU usage percentage (0-100)",
	})
)

// Disk metrics
var (
	DiskTotal = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_disk_total_bytes",
		Help: "Total disk space in bytes",
	})

	DiskUsed = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_disk_used_bytes",
		Help: "Used disk space in bytes",
	})

	DiskFree = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_disk_free_bytes",
		Help: "Free disk space in bytes",
	})

	DiskUsagePercent = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_disk_usage_percent",
		Help: "Disk usage percentage (0-100)",
	})
)

// Uptime metrics
var (
	ServiceUptimeSeconds = factory.NewGauge(prometheus.GaugeOpts{
		Name: "service_layer_uptime_seconds",
		Help: "Service uptime in seconds",
	})
)
