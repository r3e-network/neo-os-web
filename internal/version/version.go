package version

import (
	"fmt"
	"runtime"
)

// Build information set by the compiler flags
var (
	// Version is the service version
	Version = "0.1.0"
	
	// GitCommit is the git commit hash
	GitCommit = "unknown"
	
	// BuildTime is the time the binary was built
	BuildTime = "unknown"
	
	// GoVersion is the version of Go used to build the binary
	GoVersion = runtime.Version()
)

// FullVersion returns the full version string including git commit and build time
func FullVersion() string {
	return fmt.Sprintf("%s (commit: %s, built: %s, %s)", Version, GitCommit, BuildTime, GoVersion)
}

// UserAgent returns a string suitable for use as a HTTP User-Agent header
func UserAgent() string {
	return fmt.Sprintf("ServiceLayer/%s", Version)
}