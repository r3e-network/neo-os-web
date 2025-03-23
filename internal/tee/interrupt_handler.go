package tee

import (
	"context"
	"sync"
	"time"

	"github.com/dop251/goja"
)

// InterruptHandler handles the interruption of JavaScript execution
type InterruptHandler struct {
	runtime        *JSRuntime
	interruptCh    chan struct{}
	interruptTick  time.Duration
	loopCount      int64
	maxLoopCount   int64
	loopCountMutex sync.Mutex
}

// NewInterruptHandler creates a new interrupt handler
func NewInterruptHandler(runtime *JSRuntime) *InterruptHandler {
	return &InterruptHandler{
		runtime:       runtime,
		interruptTick: 100 * time.Millisecond, // 100ms check interval
		maxLoopCount:  10000000,               // Allow 10 million iterations before considering it an infinite loop
	}
}

// Setup initializes the interrupt handler
func (h *InterruptHandler) Setup() {
	// Reset loop counter
	h.loopCountMutex.Lock()
	h.loopCount = 0
	h.loopCountMutex.Unlock()

	// Create new interrupt channel
	h.interruptCh = make(chan struct{})

	// NOTE: Goja doesn't directly expose SetInterruptHandler and SetLoopInterrupt methods,
	// so we use alternative approaches for interruption:
	// 1. For general interrupts, we use the Interrupt() method
	// 2. For loop counting, we inject a loop counter into the global scope
	h.injectLoopCounterMonitor()
}

// injectLoopCounterMonitor adds a loop counter to detect infinite loops
func (h *InterruptHandler) injectLoopCounterMonitor() {
	// Try to inject a loop counter monitor into the JavaScript code
	// This is a simplified approach that sets a global __loopCounter variable
	// In a real implementation, you'd use Goja's Program transform capabilities
	// to instrument loops in the code

	// Create a global loop counter variable
	h.runtime.vm.Set("__loopCount", 0)

	// To effectively monitor loops in practice, you would need to:
	// 1. Parse the JavaScript AST
	// 2. Inject loop counter increments into all loops
	// 3. Check the counter value regularly
	// This is beyond the scope of this implementation
}

// StartInterruptChecker starts a goroutine to check for timeouts
func (h *InterruptHandler) StartInterruptChecker(ctx context.Context) {
	go h.runInterruptChecker(ctx)
}

// StopInterruptChecker stops the interrupt checker and cleans up
func (h *InterruptHandler) StopInterruptChecker() {
	if h.interruptCh != nil {
		close(h.interruptCh)
		h.interruptCh = nil
	}
}

// runInterruptChecker monitors the context for timeout
func (h *InterruptHandler) runInterruptChecker(ctx context.Context) {
	ticker := time.NewTicker(h.interruptTick)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Check if context is done (timeout reached)
			if ctx.Err() != nil {
				// Interrupt the JavaScript execution
				// Use Goja's Interrupt method to stop execution
				// This can be caught with a try/catch in JavaScript
				h.runtime.vm.Interrupt("execution timeout")
				return
			}

			// Check if we've detected an infinite loop via the loop counter
			loopCount := h.GetLoopCount()
			if loopCount > h.maxLoopCount {
				h.runtime.vm.Interrupt("infinite loop detected")
				return
			}
		case <-h.interruptCh:
			// Normal termination - exit the goroutine
			return
		}
	}
}

// GetLoopCount returns the current loop count
func (h *InterruptHandler) GetLoopCount() int64 {
	h.loopCountMutex.Lock()
	defer h.loopCountMutex.Unlock()

	// In a real implementation, this would read the loop counter from the
	// instrumented JavaScript code. For now, we're just using a placeholder.
	return h.loopCount
}

// Reset resets the interrupt handler state
func (h *InterruptHandler) Reset() {
	h.loopCountMutex.Lock()
	h.loopCount = 0
	h.loopCountMutex.Unlock()

	// Ensure old interrupt channel is closed
	if h.interruptCh != nil {
		close(h.interruptCh)
	}

	// Create new interrupt channel
	h.interruptCh = make(chan struct{})
}

// TimeoutDetails contains additional information about a timeout
type TimeoutDetails struct {
	TimeoutLimit int    `json:"timeout_limit_seconds"`
	LoopCount    int64  `json:"loop_count"`
	Context      string `json:"context,omitempty"`
}

// CreateTimeoutDetails creates a new timeout details object
func (h *InterruptHandler) CreateTimeoutDetails() *TimeoutDetails {
	return &TimeoutDetails{
		TimeoutLimit: h.runtime.timeoutLimit,
		LoopCount:    h.GetLoopCount(),
		Context:      getExecutionContext(h.runtime.vm),
	}
}

// getExecutionContext extracts information about the current execution context
func getExecutionContext(vm *goja.Runtime) string {
	// This is a simplified implementation - a real implementation would
	// extract more useful context information such as the current line
	// of code being executed
	return "execution context information not available"
}
