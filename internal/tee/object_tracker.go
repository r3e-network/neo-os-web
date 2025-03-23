package tee

import (
	"github.com/dop251/goja"
)

// ObjectSizeTracker tracks object allocations and applies memory limits
type ObjectSizeTracker struct {
	runtime *JSRuntime
}

// NewObjectSizeTracker creates a new object size tracker
func NewObjectSizeTracker(runtime *JSRuntime) *ObjectSizeTracker {
	return &ObjectSizeTracker{
		runtime: runtime,
	}
}

// Setup initializes object tracking hooks
func (t *ObjectSizeTracker) Setup() error {
	err := t.setupObjectTracking()
	if err != nil {
		return err
	}

	err = t.setupArrayTracking()
	if err != nil {
		return err
	}

	return nil
}

// setupObjectTracking hooks into object creation to track memory usage
func (t *ObjectSizeTracker) setupObjectTracking() error {
	// Get the Object constructor
	objectValue := t.runtime.vm.Get("Object")
	if objectValue == nil || goja.IsUndefined(objectValue) || goja.IsNull(objectValue) {
		return nil // No Object constructor available
	}

	objectConstructor := objectValue.ToObject(t.runtime.vm)
	origConstructor := objectConstructor.Get("constructor")

	// Create a proxy for new objects
	proxyConstructor := t.runtime.vm.ToValue(func(call goja.FunctionCall) goja.Value {
		// Estimate object size (simplified implementation)
		estimatedSize := 64 // Base object overhead

		// Try to allocate memory
		if err := t.runtime.memoryLimiter.Allocate(estimatedSize); err != nil {
			panic(t.runtime.vm.ToValue(err.Error()))
		}

		// Call original constructor
		if origConstructor != nil && !goja.IsUndefined(origConstructor) && !goja.IsNull(origConstructor) {
			origFunc, ok := goja.AssertFunction(origConstructor)
			if ok {
				// Call the function with the given arguments
				result, err := origFunc(objectConstructor, call.Arguments...)
				if err != nil {
					panic(t.runtime.vm.ToValue(err.Error()))
				}
				return result
			}
		}

		// Fallback if the original constructor is not available
		return t.runtime.vm.NewObject()
	})

	// Replace Object constructor
	objectConstructor.Set("constructor", proxyConstructor)

	return nil
}

// setupArrayTracking hooks into array creation to track memory usage
func (t *ObjectSizeTracker) setupArrayTracking() error {
	// Get the Array constructor
	arrayValue := t.runtime.vm.Get("Array")
	if arrayValue == nil || goja.IsUndefined(arrayValue) || goja.IsNull(arrayValue) {
		return nil // No Array constructor available
	}

	arrayConstructor := arrayValue.ToObject(t.runtime.vm)
	origArray := arrayConstructor.Get("constructor")

	// Create a proxy for Array constructor
	proxyConstructor := t.runtime.vm.ToValue(func(call goja.FunctionCall) goja.Value {
		// Estimate array size (simplified implementation)
		estimatedSize := 32 // Base array overhead

		// If length is provided, add size for elements
		if len(call.Arguments) > 0 {
			length := call.Arguments[0].ToInteger()
			// Assuming 8 bytes per element pointer
			estimatedSize += int(length) * 8
		}

		// Try to allocate memory
		if err := t.runtime.memoryLimiter.Allocate(estimatedSize); err != nil {
			panic(t.runtime.vm.ToValue(err.Error()))
		}

		// Call original constructor
		if origArray != nil && !goja.IsUndefined(origArray) && !goja.IsNull(origArray) {
			origFunc, ok := goja.AssertFunction(origArray)
			if ok {
				// Call the function with the given arguments
				result, err := origFunc(arrayConstructor, call.Arguments...)
				if err != nil {
					panic(t.runtime.vm.ToValue(err.Error()))
				}
				return result
			}
		}

		// Fallback if original constructor is not available
		if len(call.Arguments) > 0 {
			length := int64(call.Arguments[0].ToInteger())
			return t.runtime.vm.NewArray(length)
		}

		return t.runtime.vm.NewArray(0)
	})

	// Replace Array constructor
	arrayConstructor.Set("constructor", proxyConstructor)

	// Track Array.prototype.push to monitor runtime array growth
	arrayPrototype := arrayConstructor.Get("prototype").ToObject(t.runtime.vm)
	origPush := arrayPrototype.Get("push")

	if origPush != nil && !goja.IsUndefined(origPush) && !goja.IsNull(origPush) {
		proxyPush := t.runtime.vm.ToValue(func(call goja.FunctionCall) goja.Value {
			// Estimate size of new elements
			elementsSize := len(call.Arguments) * 8 // 8 bytes per element

			// Allocate memory for new elements
			if err := t.runtime.memoryLimiter.Allocate(elementsSize); err != nil {
				panic(t.runtime.vm.ToValue(err.Error()))
			}

			// Call original push method
			pushFunc, ok := goja.AssertFunction(origPush)
			if ok {
				// Call the push function with call.This as the receiver
				result, err := pushFunc(call.This, call.Arguments...)
				if err != nil {
					panic(t.runtime.vm.ToValue(err.Error()))
				}
				return result
			}

			return goja.Undefined()
		})

		arrayPrototype.Set("push", proxyPush)
	}

	return nil
}
