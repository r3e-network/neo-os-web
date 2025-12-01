// Architecture Verifier - Validates Service Layer conforms to Android-style Engine Architecture.
//
// This tool defines the expected architecture and verifies the current implementation against it.
// It detects:
// - Misplaced files and folders
// - Duplicate functionality
// - Incorrect implementations
// - Architecture violations
// - Missing required components
//
// Expected Architecture (Android OS Style):
//
//	applications/          - App Layer (like Android apps)
//	├── application.go     - Legacy Application (backward compat)
//	├── engine_app.go      - EngineApplication (main entry)
//	├── services.go        - ServiceBundle + ServiceProvider
//	└── httpapi/           - HTTP transport layer
//
//	system/                - OS Layer (like Android framework)
//	├── framework/         - Service framework (Android Service/Context)
//	│   ├── core/          - Core interfaces (AccountChecker, Tracer, etc.)
//	│   ├── lifecycle/     - Lifecycle management
//	│   └── testing/       - Test utilities
//	├── runtime/           - Package runtime (Android Runtime)
//	├── core/              - Engine core (Android System Server)
//	├── bootstrap/         - Bootstrap loader
//	├── events/            - Event system
//	├── platform/          - Platform abstractions
//	├── api/               - API definitions
//	└── tee/               - TEE support
//
//	packages/              - Service packages (like Android apps/services)
//	├── com.r3e.services.*/
//	│   ├── service.go     - Service implementation (embeds ServiceEngine)
//	│   ├── types.go       - Local domain types
//	│   ├── store.go       - Store interface
//	│   ├── store_postgres.go - PostgreSQL implementation
//	│   └── package.go     - Package registration
//
//	pkg/                   - Shared utilities (NOT service-specific)
//	├── logger/            - Logging
//	├── metrics/           - Metrics
//	├── tracing/           - Tracing
//	└── storage/postgres/  - Generic admin store only
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// ArchitectureRule defines an expected architectural constraint.
type ArchitectureRule struct {
	Name        string
	Description string
	Check       func(root string, report *Report) error
}

// Violation represents an architecture violation.
type Violation struct {
	Rule        string
	Severity    string // "error", "warning", "info"
	File        string
	Line        int
	Description string
	Suggestion  string
}

// Report collects all violations.
type Report struct {
	Violations []Violation
	Stats      map[string]int
}

func (r *Report) AddViolation(v Violation) {
	r.Violations = append(r.Violations, v)
	r.Stats[v.Severity]++
}

// Expected directory structure
// Note: Files listed here are checked for existence. Directories end with "/".
var expectedStructure = map[string][]string{
	"applications": {
		"application.go",
		"engine_app.go",
		"services.go",
		"httpapi/",
		"system/",
	},
	"system/framework": {
		"service_engine.go",
		"service_context.go",
		"base.go",        // ServiceBase implementation
		"environment.go", // Environment configuration
		"manifest.go",    // Service manifest
		"bus.go",         // Bus interfaces
		"core/",          // Core interfaces
		"lifecycle/",     // Lifecycle management
		"testing/",       // Test utilities
	},
	"system/framework/core": {
		"api.go",            // API definitions
		"base.go",           // Base utilities
		"errors.go",         // Error types
		"service_router.go", // Service routing
		"tracer.go",         // Tracer interface
		"observe.go",        // Observation hooks
	},
	"system/runtime": {
		"loader.go",              // Package loader
		"runtime.go",             // Runtime implementation
		"package.go",             // Package abstraction
		"store_provider.go",      // Store provider
		"environment_adapter.go", // Environment adapter
	},
	"system/core": {
		"engine.go",
		"bus.go",
		"interfaces.go", // Core interfaces
	},
	"system/bootstrap": {
		"bootstrap.go",
	},
}

// Files/patterns that should NOT exist in certain locations
var forbiddenPatterns = map[string][]string{
	"system/framework": {
		"store_*.go",           // Service-specific stores don't belong here
		"*_automation*.go",     // Service-specific code
		"*_gasbank*.go",        // Service-specific code
		"*_oracle*.go",         // Service-specific code
		"*_vrf*.go",            // Service-specific code
		"*_datafeeds*.go",      // Service-specific code
		"*_datastreams*.go",    // Service-specific code
		"*_datalink*.go",       // Service-specific code
		"*_ccip*.go",           // Service-specific code
		"*_cre*.go",            // Service-specific code
		"*_dta*.go",            // Service-specific code
		"*_confidential*.go",   // Service-specific code
		"*_mixer*.go",          // Service-specific code
		"*_secrets*.go",        // Service-specific code
	},
	"system/core": {
		"handler_*.go", // HTTP handlers don't belong in core
	},
	"pkg/storage/postgres": {
		"store_automation*.go",
		"store_gasbank*.go",
		"store_oracle*.go",
		"store_vrf*.go",
		"store_datafeeds*.go",
		"store_datastreams*.go",
		"store_datalink*.go",
		"store_ccip*.go",
		"store_cre*.go",
		"store_dta*.go",
		"store_confidential*.go",
		"store_mixer*.go",
		"store_secrets*.go",
		"store_functions*.go",
		"store_accounts*.go",
	},
}

// Required patterns for service packages
// Note: types can be in types.go OR domain.go (both are acceptable)
var servicePackageRequirements = []string{
	"service.go",
	"package.go",
}

// Alternative type files (at least one should exist)
var typeFileAlternatives = []string{
	"types.go",
	"domain.go",
	"model.go", // Some packages use model.go for domain types
}

// Import rules: source -> forbidden imports
var importRules = map[string][]string{
	"system/framework":       {"packages/"},
	"system/framework/core":  {"packages/"},
	"system/core":            {"packages/", "applications/"},
	"system/runtime":         {"packages/", "applications/"},
	"system/bootstrap":       {}, // Can import packages for registration
	"pkg/":                   {"packages/", "applications/"},
}

// ServiceEngine embedding check
var serviceEnginePattern = regexp.MustCompile(`\*framework\.ServiceEngine`)

// Duplicate functionality patterns
var duplicateFunctionPatterns = []struct {
	Pattern     string
	Description string
}{
	{`func.*AccountExists.*context\.Context.*string.*error`, "AccountExists should use framework.AccountChecker"},
	{`func.*ValidateAccount.*context\.Context.*string.*error`, "ValidateAccount should use ServiceEngine.ValidateAccount"},
	{`type AccountChecker interface`, "AccountChecker should be imported from framework/core"},
	{`type WalletChecker interface`, "WalletChecker should be imported from framework/core"},
}

func main() {
	dir := flag.String("dir", ".", "Root directory to scan")
	verbose := flag.Bool("v", false, "Verbose output")
	fix := flag.Bool("fix", false, "Suggest fixes (does not modify files)")
	flag.Parse()

	report := &Report{
		Stats: make(map[string]int),
	}

	rules := []ArchitectureRule{
		{
			Name:        "directory-structure",
			Description: "Verify expected directory structure exists",
			Check:       checkDirectoryStructure,
		},
		{
			Name:        "forbidden-files",
			Description: "Check for files in wrong locations",
			Check:       checkForbiddenFiles,
		},
		{
			Name:        "import-violations",
			Description: "Check for forbidden imports",
			Check:       checkImportViolations,
		},
		{
			Name:        "service-engine-embedding",
			Description: "Verify services embed ServiceEngine",
			Check:       checkServiceEngineEmbedding,
		},
		{
			Name:        "duplicate-functionality",
			Description: "Detect duplicate interface/function definitions",
			Check:       checkDuplicateFunctionality,
		},
		{
			Name:        "service-package-structure",
			Description: "Verify service package structure",
			Check:       checkServicePackageStructure,
		},
		{
			Name:        "domain-directory",
			Description: "Check domain/ directory doesn't exist",
			Check:       checkNoDomainDirectory,
		},
		{
			Name:        "legacy-stores",
			Description: "Check for legacy service stores in pkg/storage",
			Check:       checkLegacyStores,
		},
		{
			Name:        "engine-context-usage",
			Description: "Verify EngineContext pattern usage",
			Check:       checkEngineContextUsage,
		},
		{
			Name:        "http-handler-location",
			Description: "Verify HTTP handlers are in correct location",
			Check:       checkHTTPHandlerLocation,
		},
	}

	fmt.Println("================================================================================")
	fmt.Println("SERVICE LAYER ARCHITECTURE VERIFIER")
	fmt.Println("================================================================================")
	fmt.Println()
	fmt.Println("Verifying Android-style Engine Architecture...")
	fmt.Println()

	for _, rule := range rules {
		if *verbose {
			fmt.Printf("Checking: %s\n", rule.Name)
		}
		if err := rule.Check(*dir, report); err != nil {
			fmt.Printf("Error running rule %s: %v\n", rule.Name, err)
		}
	}

	printReport(report, *verbose, *fix)
}

func checkDirectoryStructure(root string, report *Report) error {
	for dir, expectedFiles := range expectedStructure {
		fullPath := filepath.Join(root, dir)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			report.AddViolation(Violation{
				Rule:        "directory-structure",
				Severity:    "error",
				File:        dir,
				Description: fmt.Sprintf("Expected directory does not exist: %s", dir),
				Suggestion:  fmt.Sprintf("Create directory: mkdir -p %s", dir),
			})
			continue
		}

		for _, expected := range expectedFiles {
			expectedPath := filepath.Join(fullPath, expected)
			if _, err := os.Stat(expectedPath); os.IsNotExist(err) {
				severity := "warning"
				if strings.HasSuffix(expected, "/") {
					severity = "info"
				}
				report.AddViolation(Violation{
					Rule:        "directory-structure",
					Severity:    severity,
					File:        filepath.Join(dir, expected),
					Description: fmt.Sprintf("Expected file/directory missing: %s", expected),
				})
			}
		}
	}
	return nil
}

func checkForbiddenFiles(root string, report *Report) error {
	for dir, patterns := range forbiddenPatterns {
		fullPath := filepath.Join(root, dir)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			continue
		}

		entries, err := os.ReadDir(fullPath)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			for _, pattern := range patterns {
				matched, _ := filepath.Match(pattern, entry.Name())
				if matched {
					report.AddViolation(Violation{
						Rule:        "forbidden-files",
						Severity:    "error",
						File:        filepath.Join(dir, entry.Name()),
						Description: fmt.Sprintf("File should not exist in %s: %s", dir, entry.Name()),
						Suggestion:  "Move to appropriate service package in packages/",
					})
				}
			}
		}
	}
	return nil
}

func checkImportViolations(root string, report *Report) error {
	for sourceDir, forbiddenImports := range importRules {
		fullPath := filepath.Join(root, sourceDir)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			continue
		}

		filepath.Walk(fullPath, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() || !strings.HasSuffix(path, ".go") {
				return nil
			}
			if strings.HasSuffix(path, "_test.go") {
				return nil
			}

			content, err := os.ReadFile(path)
			if err != nil {
				return nil
			}

			relPath, _ := filepath.Rel(root, path)
			lines := strings.Split(string(content), "\n")
			inImport := false

			for lineNum, line := range lines {
				if strings.Contains(line, "import (") {
					inImport = true
					continue
				}
				if inImport && strings.TrimSpace(line) == ")" {
					inImport = false
					continue
				}

				if inImport || strings.HasPrefix(strings.TrimSpace(line), "import ") {
					for _, forbidden := range forbiddenImports {
						if strings.Contains(line, "service_layer/"+forbidden) {
							report.AddViolation(Violation{
								Rule:        "import-violations",
								Severity:    "error",
								File:        relPath,
								Line:        lineNum + 1,
								Description: fmt.Sprintf("Forbidden import from %s: %s", sourceDir, forbidden),
								Suggestion:  "Framework/core should not import service packages",
							})
						}
					}
				}
			}
			return nil
		})
	}
	return nil
}

func checkServiceEngineEmbedding(root string, report *Report) error {
	packagesDir := filepath.Join(root, "packages")
	if _, err := os.Stat(packagesDir); os.IsNotExist(err) {
		return nil
	}

	entries, err := os.ReadDir(packagesDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasPrefix(entry.Name(), "com.r3e.services.") {
			continue
		}

		servicePath := filepath.Join(packagesDir, entry.Name(), "service.go")
		if _, err := os.Stat(servicePath); os.IsNotExist(err) {
			continue
		}

		content, err := os.ReadFile(servicePath)
		if err != nil {
			continue
		}

		if !serviceEnginePattern.Match(content) {
			report.AddViolation(Violation{
				Rule:        "service-engine-embedding",
				Severity:    "error",
				File:        filepath.Join("packages", entry.Name(), "service.go"),
				Description: "Service does not embed *framework.ServiceEngine",
				Suggestion:  "Add '*framework.ServiceEngine' to Service struct",
			})
		}
	}
	return nil
}

func checkDuplicateFunctionality(root string, report *Report) error {
	packagesDir := filepath.Join(root, "packages")
	if _, err := os.Stat(packagesDir); os.IsNotExist(err) {
		return nil
	}

	filepath.Walk(packagesDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}
		if strings.HasSuffix(path, "_test.go") {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		relPath, _ := filepath.Rel(root, path)
		lines := strings.Split(string(content), "\n")

		for _, dp := range duplicateFunctionPatterns {
			pattern := regexp.MustCompile(dp.Pattern)
			for lineNum, line := range lines {
				if pattern.MatchString(line) {
					// Skip if it's in types.go (local interface definition is OK)
					if strings.HasSuffix(path, "types.go") && strings.Contains(dp.Pattern, "interface") {
						continue
					}
					report.AddViolation(Violation{
						Rule:        "duplicate-functionality",
						Severity:    "warning",
						File:        relPath,
						Line:        lineNum + 1,
						Description: dp.Description,
						Suggestion:  "Use framework-provided implementation",
					})
				}
			}
		}
		return nil
	})
	return nil
}

func checkServicePackageStructure(root string, report *Report) error {
	packagesDir := filepath.Join(root, "packages")
	if _, err := os.Stat(packagesDir); os.IsNotExist(err) {
		return nil
	}

	entries, err := os.ReadDir(packagesDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasPrefix(entry.Name(), "com.r3e.services.") {
			continue
		}

		pkgPath := filepath.Join(packagesDir, entry.Name())

		// Check required files (service.go, package.go)
		for _, required := range servicePackageRequirements {
			filePath := filepath.Join(pkgPath, required)
			if _, err := os.Stat(filePath); os.IsNotExist(err) {
				report.AddViolation(Violation{
					Rule:        "service-package-structure",
					Severity:    "warning",
					File:        filepath.Join("packages", entry.Name()),
					Description: fmt.Sprintf("Missing required file: %s", required),
					Suggestion:  fmt.Sprintf("Create %s following the standard pattern", required),
				})
			}
		}

		// Check for type definition file (types.go OR domain.go - at least one should exist)
		hasTypeFile := false
		for _, typeFile := range typeFileAlternatives {
			filePath := filepath.Join(pkgPath, typeFile)
			if _, err := os.Stat(filePath); err == nil {
				hasTypeFile = true
				break
			}
		}
		if !hasTypeFile {
			report.AddViolation(Violation{
				Rule:        "service-package-structure",
				Severity:    "info",
				File:        filepath.Join("packages", entry.Name()),
				Description: "Missing type definition file (types.go or domain.go)",
				Suggestion:  "Create types.go or domain.go with local domain types",
			})
		}

		// Check for forbidden imports from global domain/ directory
		servicePath := filepath.Join(pkgPath, "service.go")
		if content, err := os.ReadFile(servicePath); err == nil {
			if strings.Contains(string(content), `"github.com/R3E-Network/service_layer/domain/`) {
				report.AddViolation(Violation{
					Rule:        "service-package-structure",
					Severity:    "error",
					File:        filepath.Join("packages", entry.Name(), "service.go"),
					Description: "Service imports from domain/ - should use local types",
					Suggestion:  "Define types locally in types.go or domain.go",
				})
			}
		}
	}
	return nil
}

func checkNoDomainDirectory(root string, report *Report) error {
	domainPath := filepath.Join(root, "domain")
	if info, err := os.Stat(domainPath); err == nil && info.IsDir() {
		entries, _ := os.ReadDir(domainPath)
		if len(entries) > 0 {
			report.AddViolation(Violation{
				Rule:        "domain-directory",
				Severity:    "error",
				File:        "domain/",
				Description: "domain/ directory should not exist - types should be local to packages",
				Suggestion:  "Move types to respective service packages and delete domain/",
			})
		}
	}
	return nil
}

func checkLegacyStores(root string, report *Report) error {
	storagePath := filepath.Join(root, "pkg", "storage", "postgres")
	if _, err := os.Stat(storagePath); os.IsNotExist(err) {
		return nil
	}

	entries, err := os.ReadDir(storagePath)
	if err != nil {
		return err
	}

	serviceStorePatterns := []string{
		"store_automation", "store_oracle", "store_gasbank", "store_vrf",
		"store_ccip", "store_cre", "store_datafeeds", "store_datastreams",
		"store_datalink", "store_mixer", "store_confidential", "store_secrets",
		"store_functions", "store_accounts",
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		for _, pattern := range serviceStorePatterns {
			if strings.Contains(entry.Name(), pattern) {
				report.AddViolation(Violation{
					Rule:        "legacy-stores",
					Severity:    "error",
					File:        filepath.Join("pkg/storage/postgres", entry.Name()),
					Description: "Service-specific store should be in packages/",
					Suggestion:  "Move to respective service package",
				})
			}
		}
	}
	return nil
}

func checkEngineContextUsage(root string, report *Report) error {
	frameworkPath := filepath.Join(root, "system", "framework")

	// Check EngineContext interface exists
	contextPath := filepath.Join(frameworkPath, "service_context.go")
	if _, err := os.Stat(contextPath); os.IsNotExist(err) {
		report.AddViolation(Violation{
			Rule:        "engine-context-usage",
			Severity:    "error",
			File:        "system/framework/service_context.go",
			Description: "EngineContext interface file missing",
			Suggestion:  "Create service_context.go with EngineContext interface",
		})
		return nil
	}

	content, err := os.ReadFile(contextPath)
	if err != nil {
		return err
	}

	// Check for required EngineContext methods
	requiredMethods := []string{
		"SystemService",
		"StoreProvider",
		"Bus",
		"Tracer",
		"Metrics",
		"Quota",
	}

	for _, method := range requiredMethods {
		if !strings.Contains(string(content), method+"(") {
			report.AddViolation(Violation{
				Rule:        "engine-context-usage",
				Severity:    "warning",
				File:        "system/framework/service_context.go",
				Description: fmt.Sprintf("EngineContext missing method: %s", method),
				Suggestion:  "Add method to EngineContext interface",
			})
		}
	}

	// Check ServiceEngine exposes Context()
	enginePath := filepath.Join(frameworkPath, "service_engine.go")
	if engineContent, err := os.ReadFile(enginePath); err == nil {
		if !strings.Contains(string(engineContent), "func (e *ServiceEngine) Context()") {
			report.AddViolation(Violation{
				Rule:        "engine-context-usage",
				Severity:    "error",
				File:        "system/framework/service_engine.go",
				Description: "ServiceEngine missing Context() method",
				Suggestion:  "Add Context() EngineContext method to ServiceEngine",
			})
		}
	}

	return nil
}

func checkHTTPHandlerLocation(root string, report *Report) error {
	// HTTP handlers should be in applications/httpapi/ or in service packages
	// NOT in system/
	systemPath := filepath.Join(root, "system")

	filepath.Walk(systemPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		if strings.HasPrefix(info.Name(), "handler_") && strings.HasSuffix(info.Name(), ".go") {
			relPath, _ := filepath.Rel(root, path)
			report.AddViolation(Violation{
				Rule:        "http-handler-location",
				Severity:    "error",
				File:        relPath,
				Description: "HTTP handler in system/ - should be in applications/httpapi/ or service package",
				Suggestion:  "Move to applications/httpapi/ or respective service package",
			})
		}
		return nil
	})

	return nil
}

func printReport(report *Report, verbose, fix bool) {
	fmt.Println("================================================================================")
	fmt.Println("VERIFICATION RESULTS")
	fmt.Println("================================================================================")
	fmt.Println()

	if len(report.Violations) == 0 {
		fmt.Println("✅ No architecture violations found!")
		fmt.Println()
		fmt.Println("The codebase conforms to the Android-style Engine Architecture.")
		return
	}

	// Group by rule
	byRule := make(map[string][]Violation)
	for _, v := range report.Violations {
		byRule[v.Rule] = append(byRule[v.Rule], v)
	}

	// Sort rules
	rules := make([]string, 0, len(byRule))
	for rule := range byRule {
		rules = append(rules, rule)
	}
	sort.Strings(rules)

	for _, rule := range rules {
		violations := byRule[rule]
		fmt.Printf("--------------------------------------------------------------------------------\n")
		fmt.Printf("%s (%d violations)\n", strings.ToUpper(rule), len(violations))
		fmt.Printf("--------------------------------------------------------------------------------\n")

		// Group by severity
		bySeverity := map[string][]Violation{
			"error":   {},
			"warning": {},
			"info":    {},
		}
		for _, v := range violations {
			bySeverity[v.Severity] = append(bySeverity[v.Severity], v)
		}

		for _, severity := range []string{"error", "warning", "info"} {
			sevViolations := bySeverity[severity]
			if len(sevViolations) == 0 {
				continue
			}

			icon := "❌"
			if severity == "warning" {
				icon = "⚠️"
			} else if severity == "info" {
				icon = "ℹ️"
			}

			for _, v := range sevViolations {
				location := v.File
				if v.Line > 0 {
					location = fmt.Sprintf("%s:%d", v.File, v.Line)
				}
				fmt.Printf("\n%s [%s] %s\n", icon, severity, location)
				fmt.Printf("   %s\n", v.Description)
				if fix && v.Suggestion != "" {
					fmt.Printf("   💡 Suggestion: %s\n", v.Suggestion)
				}
			}
		}
		fmt.Println()
	}

	// Summary
	fmt.Println("================================================================================")
	fmt.Println("SUMMARY")
	fmt.Println("================================================================================")
	fmt.Printf("Errors:   %d\n", report.Stats["error"])
	fmt.Printf("Warnings: %d\n", report.Stats["warning"])
	fmt.Printf("Info:     %d\n", report.Stats["info"])
	fmt.Printf("Total:    %d\n", len(report.Violations))
	fmt.Println()

	if report.Stats["error"] > 0 {
		fmt.Println("❌ Architecture verification FAILED")
		fmt.Println()
		fmt.Println("RECOMMENDED ACTIONS:")
		fmt.Println("1. Fix all errors before proceeding")
		fmt.Println("2. Service-specific code should be in packages/")
		fmt.Println("3. Framework should not import service packages")
		fmt.Println("4. All services should embed *framework.ServiceEngine")
		fmt.Println("5. Use EngineContext for runtime primitives access")
	} else if report.Stats["warning"] > 0 {
		fmt.Println("⚠️  Architecture verification PASSED with warnings")
	} else {
		fmt.Println("✅ Architecture verification PASSED")
	}
}
