package service

import "context"

// APIEndpoint defines a single API endpoint exposed by a service.
// Services declare endpoints in their APIEndpoints() method.
// The service engine automatically handles HTTP routing.
type APIEndpoint struct {
	Method      string // HTTP method: GET, POST, PUT, PATCH, DELETE
	Path        string // Path relative to service (e.g., "jobs", "jobs/{id}")
	Handler     string // Method name on the service (e.g., "ListJobs")
	Description string // For documentation
}

// APIProvider is implemented by services that expose HTTP APIs.
// Example:
//
//	func (s *Service) APIEndpoints() []APIEndpoint {
//	    return []APIEndpoint{
//	        {"GET", "jobs", "ListJobs", "List all jobs"},
//	        {"POST", "jobs", "CreateJob", "Create a job"},
//	        {"GET", "jobs/{id}", "GetJob", "Get job by ID"},
//	    }
//	}
type APIProvider interface {
	APIEndpoints() []APIEndpoint
}

// APIRequest contains request data passed to API handlers.
type APIRequest struct {
	AccountID  string
	PathParams map[string]string
	Query      map[string]string
	Body       map[string]any
}

// APIHandlerFunc is the signature for API handler methods.
type APIHandlerFunc func(ctx context.Context, req APIRequest) (any, error)

// HTTP method constants
const (
	GET    = "GET"
	POST   = "POST"
	PUT    = "PUT"
	PATCH  = "PATCH"
	DELETE = "DELETE"
)
