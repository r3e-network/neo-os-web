package cache

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ResponseCacheKeyFunc is a function that generates a cache key for a request
type ResponseCacheKeyFunc func(*gin.Context) string

// CacheMiddleware is a gin middleware that caches API responses
func CacheMiddleware(cacheManager *CacheManager, ttl time.Duration, keyFunc ResponseCacheKeyFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip caching for non-GET requests
		if c.Request.Method != http.MethodGet {
			c.Next()
			return
		}

		// Skip if cache is disabled
		if cacheManager == nil || !cacheManager.enabled {
			c.Next()
			return
		}

		// Generate cache key
		key := keyFunc(c)
		if key == "" {
			c.Next()
			return
		}

		// Try to get from cache
		var cachedResponse gin.H
		found, err := cacheManager.Get(c.Request.Context(), key, &cachedResponse)
		if err == nil && found {
			// Cache hit
			cacheManager.logger.Debugf("Cache hit for %s: %s", c.Request.URL.Path, key)
			c.JSON(http.StatusOK, cachedResponse)
			c.Abort()
			return
		}

		// Set up response recording
		writer := &responseWriter{ResponseWriter: c.Writer, body: &bytes.Buffer{}}
		c.Writer = writer

		// Process request
		c.Next()

		// Only cache successful responses
		if c.Writer.Status() == http.StatusOK {
			var response gin.H
			if err := jsonFromBytes(writer.body.Bytes(), &response); err == nil {
				// Add cache metadata
				response["_cached"] = false

				// Store in cache
				ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
				defer cancel()

				cacheManager.Set(ctx, key, response, ttl, false)
				cacheManager.logger.Debugf("Cached response for %s: %s (TTL: %v)", c.Request.URL.Path, key, ttl)
			}
		}
	}
}

// CacheControlMiddleware sets Cache-Control headers
func CacheControlMiddleware(maxAge int) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Don't cache errors
		if c.Writer.Status() != http.StatusOK {
			c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
			c.Header("Pragma", "no-cache")
			c.Header("Expires", "0")
			return
		}

		// Set cache headers
		if maxAge > 0 {
			c.Header("Cache-Control", fmt.Sprintf("public, max-age=%d", maxAge))
			c.Header("Expires", time.Now().Add(time.Duration(maxAge)*time.Second).UTC().Format(http.TimeFormat))
		} else {
			c.Header("Cache-Control", "no-cache, private")
		}
	}
}

// DefaultCacheKeyFunc generates a default cache key based on URL and query parameters
func DefaultCacheKeyFunc(service string) ResponseCacheKeyFunc {
	return func(c *gin.Context) string {
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		// Get user ID from context if available
		userID, exists := c.Get("user_id")
		if !exists {
			userID = "public"
		}

		// Build key
		// Format: api:{path}:{query}:{user}
		pathParts := strings.Split(strings.Trim(path, "/"), "/")
		if len(pathParts) < 3 {
			return ""
		}

		entity := pathParts[2] // assuming paths like /api/v1/entity
		operation := "list"
		id := ""

		if len(pathParts) > 3 {
			id = pathParts[3]
			if len(pathParts) > 4 {
				operation = pathParts[4]
			} else {
				operation = "details"
			}
		}

		if query != "" {
			return fmt.Sprintf("%s:%s:%s:%s:%s:%v", service, entity, id, operation, query, userID)
		}

		return fmt.Sprintf("%s:%s:%s:%s:%v", service, entity, id, operation, userID)
	}
}

// EndpointCacheMiddleware adds caching to specific endpoints
func EndpointCacheMiddleware(cacheManager *CacheManager, endpointConfig []EndpointCacheItem) gin.HandlerFunc {
	// Build endpoint map for faster lookup
	endpointMap := make(map[string]EndpointCacheItem)
	for _, item := range endpointConfig {
		endpointMap[item.Path] = item
	}

	return func(c *gin.Context) {
		path := c.Request.URL.Path

		// Skip if not GET request
		if c.Request.Method != http.MethodGet {
			c.Next()
			return
		}

		// Find endpoint configuration
		endpoint, exists := endpointMap[path]
		if !exists {
			c.Next()
			return
		}

		// Apply cache-control headers
		if endpoint.HTTPCache > 0 {
			c.Header("Cache-Control", fmt.Sprintf("public, max-age=%d", endpoint.HTTPCache))
			c.Header("Expires", time.Now().Add(time.Duration(endpoint.HTTPCache)*time.Second).UTC().Format(http.TimeFormat))
		}

		if cacheManager == nil || !cacheManager.enabled || endpoint.TTL <= 0 {
			c.Next()
			return
		}

		// Generate cache key
		key := DefaultCacheKeyFunc("api")(c)
		if key == "" {
			c.Next()
			return
		}

		// Try to get from cache
		var cachedResponse gin.H
		found, err := cacheManager.Get(c.Request.Context(), key, &cachedResponse)
		if err == nil && found {
			// Cache hit
			c.JSON(http.StatusOK, cachedResponse)
			c.Abort()
			return
		}

		// Set up response recording
		writer := &responseWriter{ResponseWriter: c.Writer, body: &bytes.Buffer{}}
		c.Writer = writer

		// Process request
		c.Next()

		// Only cache successful responses
		if c.Writer.Status() == http.StatusOK {
			var response gin.H
			if err := jsonFromBytes(writer.body.Bytes(), &response); err == nil {
				// Add cache metadata
				response["_cached"] = false

				// Store in cache
				ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
				defer cancel()

				ttl := time.Duration(endpoint.TTL) * time.Second
				cacheManager.Set(ctx, key, response, ttl, false)
			}
		}
	}
}

// responseWriter is a wrapper for gin.ResponseWriter that captures the response body
type responseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

// Write captures the response body
func (w *responseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// WriteString captures the response body
func (w *responseWriter) WriteString(s string) (int, error) {
	w.body.WriteString(s)
	return w.ResponseWriter.WriteString(s)
}

// jsonFromBytes unmarshals JSON from bytes
func jsonFromBytes(data []byte, v interface{}) error {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	return decoder.Decode(v)
}
