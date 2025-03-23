package tee

import (
	"context"
	"sync"

	"github.com/dop251/goja"
)

// FunctionExecutionContext contains context information for a function execution
type FunctionExecutionContext struct {
	FunctionID  string
	UserID      int
	ExecutionID string
}

// IsolationManager handles function isolation between executions
type IsolationManager struct {
	runtime *JSRuntime

	// Execution context
	currentContext *FunctionExecutionContext
	contextMutex   sync.Mutex

	// Global object compartmentalization
	allowedGlobals map[string]bool
}

// NewIsolationManager creates a new isolation manager
func NewIsolationManager(runtime *JSRuntime) *IsolationManager {
	return &IsolationManager{
		runtime: runtime,
		allowedGlobals: map[string]bool{
			"console":          true,
			"JSON":             true,
			"Math":             true,
			"Date":             true,
			"RegExp":           true,
			"String":           true,
			"Number":           true,
			"Boolean":          true,
			"Array":            true,
			"Object":           true,
			"Error":            true,
			"TypeError":        true,
			"SyntaxError":      true,
			"RangeError":       true,
			"fetch":            true,
			"secrets":          true,
			"crypto":           true,
			"params":           true,
			"executionContext": true,
			"setTimeout":       true,
			"__loopCount":      true, // Used by the interrupt handler
		},
	}
}

// Setup initializes the isolation manager
func (im *IsolationManager) Setup() error {
	// Freeze built-in prototypes to prevent modifications
	err := im.freezeBuiltInPrototypes()
	if err != nil {
		return err
	}

	// Apply strict mode and restrict global object
	err = im.applySandboxRestrictions()
	if err != nil {
		return err
	}

	return nil
}

// SetExecutionContext sets the current execution context
func (im *IsolationManager) SetExecutionContext(functionID string, userID int, executionID string) {
	im.contextMutex.Lock()
	defer im.contextMutex.Unlock()

	im.currentContext = &FunctionExecutionContext{
		FunctionID:  functionID,
		UserID:      userID,
		ExecutionID: executionID,
	}
}

// GetExecutionContext gets the current execution context
func (im *IsolationManager) GetExecutionContext() *FunctionExecutionContext {
	im.contextMutex.Lock()
	defer im.contextMutex.Unlock()

	return im.currentContext
}

// CreateExecutionContextObject creates a JavaScript object with execution context
func (im *IsolationManager) CreateExecutionContextObject() *goja.Object {
	ctx := im.GetExecutionContext()
	if ctx == nil {
		return nil
	}

	execContext := im.runtime.vm.NewObject()
	execContext.Set("functionID", ctx.FunctionID)
	execContext.Set("userID", ctx.UserID)
	execContext.Set("executionID", ctx.ExecutionID)

	return execContext
}

// freezeBuiltInPrototypes prevents modifications to standard prototypes
func (im *IsolationManager) freezeBuiltInPrototypes() error {
	// Get Object.freeze function if available
	freezeVal := im.runtime.vm.Get("Object").ToObject(im.runtime.vm).Get("freeze")
	if freezeVal == nil || goja.IsUndefined(freezeVal) || goja.IsNull(freezeVal) {
		// If Object.freeze is not available, we can't freeze prototypes
		// This should not happen in a standard JavaScript environment
		return nil
	}

	freeze, ok := goja.AssertFunction(freezeVal)
	if !ok {
		return nil
	}

	// List of built-in prototypes to freeze
	prototypes := []struct {
		obj  string
		prop string
	}{
		{"Object", "prototype"},
		{"Array", "prototype"},
		{"String", "prototype"},
		{"Number", "prototype"},
		{"Boolean", "prototype"},
		{"Function", "prototype"},
		{"Date", "prototype"},
		{"RegExp", "prototype"},
		{"Error", "prototype"},
	}

	// Freeze each prototype
	for _, p := range prototypes {
		objVal := im.runtime.vm.Get(p.obj)
		if objVal == nil || goja.IsUndefined(objVal) || goja.IsNull(objVal) {
			continue
		}

		obj := objVal.ToObject(im.runtime.vm)
		proto := obj.Get(p.prop)
		if proto == nil || goja.IsUndefined(proto) || goja.IsNull(proto) {
			continue
		}

		_, _ = freeze(goja.Undefined(), proto)
	}

	return nil
}

// applySandboxRestrictions applies strict mode and sandbox security
func (im *IsolationManager) applySandboxRestrictions() error {
	// Apply strict mode
	_, err := im.runtime.vm.RunString(`"use strict";`)
	if err != nil {
		return err
	}

	// Add sandbox security code
	sandboxCode := `
		// Prevent defining or accessing global variables directly
		(function() {
			try {
				// Prevent access to global object via constructor chains
				Object.defineProperty(Object.prototype, 'constructor', {
					configurable: false,
					writable: false
				});
				
				// Prevent with statement
				Object.defineProperty(Object.prototype, '__defineGetter__', {
					configurable: false,
					writable: false
				});
				
				Object.defineProperty(Object.prototype, '__defineSetter__', {
					configurable: false,
					writable: false
				});
			} catch (e) {
				// Ignore errors in setting up restrictions
				console.error("Warning: Could not fully restrict sandbox: " + e.message);
			}
		})();
	`

	_, err = im.runtime.vm.RunString(sandboxCode)

	return err
}

// ResetState resets the isolation manager state between executions
func (im *IsolationManager) ResetState() {
	im.contextMutex.Lock()
	defer im.contextMutex.Unlock()

	im.currentContext = nil
}

// CleanupAfterExecution performs cleanup after function execution
func (im *IsolationManager) CleanupAfterExecution(ctx context.Context) {
	// Clear execution context
	im.ResetState()
}
