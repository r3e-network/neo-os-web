// Package middleware provides HTTP middleware for the service layer.
package middleware

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// GracefulShutdown manages graceful server shutdown.
type GracefulShutdown struct {
	mu           sync.Mutex
	server       *http.Server
	timeout      time.Duration
	shutdownChan chan struct{}
	callbacks    []func()
}

// NewGracefulShutdown creates a new graceful shutdown manager.
func NewGracefulShutdown(server *http.Server, timeout time.Duration) *GracefulShutdown {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &GracefulShutdown{
		server:       server,
		timeout:      timeout,
		shutdownChan: make(chan struct{}),
	}
}

// OnShutdown registers a callback to run during shutdown.
func (g *GracefulShutdown) OnShutdown(callback func()) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.callbacks = append(g.callbacks, callback)
}

// ListenForSignals starts listening for shutdown signals.
func (g *GracefulShutdown) ListenForSignals() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT)

	go func() {
		sig := <-sigChan
		log.Printf("Received signal %v, initiating graceful shutdown...", sig)
		g.Shutdown()
	}()
}

// Shutdown initiates graceful shutdown.
func (g *GracefulShutdown) Shutdown() {
	g.mu.Lock()
	defer g.mu.Unlock()

	// Run shutdown callbacks
	for _, callback := range g.callbacks {
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Panic in shutdown callback: %v", r)
				}
			}()
			callback()
		}()
	}

	// Shutdown HTTP server
	if g.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), g.timeout)
		defer cancel()

		if err := g.server.Shutdown(ctx); err != nil {
			log.Printf("Error during server shutdown: %v", err)
		}
	}

	close(g.shutdownChan)
}

// Wait blocks until shutdown is complete.
func (g *GracefulShutdown) Wait() {
	<-g.shutdownChan
}
