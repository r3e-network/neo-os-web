// Architecture Checker - Detects service-specific code in the core framework layer.
//
// The Service Layer should be a pure "Service Operating System" that is completely
// agnostic to any specific service implementation. Like Android doesn't know about
// specific apps, the framework should not know about specific services.
//
// Architecture Rules:
// 1. system/ should NOT import from packages/ (service implementations)
// 2. pkg/storage/ should NOT contain service-specific store implementations
// 3. Core framework should only provide generic interfaces and utilities
//
// Allowed:
// - packages/ can import from system/ (services use the framework)
// - packages/ define their own domain types locally (no shared domain/)
// - system/ can import from pkg/ (framework uses utilities)

package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// Service-specific keywords that should NOT appear in the framework layer
// Note: Generic words like "secrets", "Message" are excluded to avoid false positives
var serviceKeywords = []string{
	// Service names (specific to this project)
	"automation", "datafeeds", "datastreams", "datalink",
	"gasbank", "ccip", "cre", "dta", "mixer", "confidential",
	"chainlink",
	// Service-specific domain concepts
	"DataSource", "DataFeed", "GasAccount", "VRFKey", "Playbook",
	"PrivacySet", "AutomationJob", "GasBankAccount",
}

// Directories that should be service-agnostic (the "OS" layer)
var frameworkDirs = []string{
	"system/framework",
	"system/core",
	"system/events",
	"system/platform",
	"system/runtime",
	"system/bootstrap",
	"system/api",
	"system/tee",
}

// Directories that contain service-specific code (allowed to have service knowledge)
var serviceDirs = []string{
	"packages/",
	"applications/",
}

// Import patterns that indicate architecture violations
var violationPatterns = []struct {
	pattern     string
	description string
}{
	{`"github.com/R3E-Network/service_layer/packages/`, "Framework imports service packages"},
}

type Violation struct {
	File        string
	Line        int
	Type        string
	Description string
	Content     string
}

type ArchitectureReport struct {
	ImportViolations  []Violation
	KeywordViolations []Violation
	StoreViolations   []Violation
	Summary           map[string]int
}

func main() {
	dir := flag.String("dir", ".", "Directory to scan")
	verbose := flag.Bool("v", false, "Verbose output")
	flag.Parse()

	report := &ArchitectureReport{
		Summary: make(map[string]int),
	}

	// Check import violations in framework directories
	for _, fwDir := range frameworkDirs {
		fullPath := filepath.Join(*dir, fwDir)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			continue
		}
		checkImportViolations(fullPath, report, *verbose)
	}

	// Check for service-specific stores in pkg/storage
	storagePath := filepath.Join(*dir, "pkg/storage")
	if _, err := os.Stat(storagePath); err == nil {
		checkStorageViolations(storagePath, report, *verbose)
	}

	// Check for service keywords in framework code
	for _, fwDir := range frameworkDirs {
		fullPath := filepath.Join(*dir, fwDir)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			continue
		}
		checkKeywordViolations(fullPath, report, *verbose)
	}

	printReport(report)
}

func checkImportViolations(dir string, report *ArchitectureReport, verbose bool) {
	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}
		// Skip test files for import checks
		if strings.HasSuffix(path, "_test.go") {
			return nil
		}

		file, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		lineNum := 0
		inImport := false

		for scanner.Scan() {
			lineNum++
			line := scanner.Text()

			// Track import block
			if strings.Contains(line, "import (") {
				inImport = true
				continue
			}
			if inImport && strings.TrimSpace(line) == ")" {
				inImport = false
				continue
			}
			if strings.HasPrefix(strings.TrimSpace(line), "import ") {
				inImport = true
			}

			if inImport || strings.HasPrefix(strings.TrimSpace(line), "import ") {
				for _, vp := range violationPatterns {
					if strings.Contains(line, vp.pattern[:len(vp.pattern)-1]) {
						// Extract the actual import
						importMatch := regexp.MustCompile(`"([^"]+)"`).FindStringSubmatch(line)
						importPath := ""
						if len(importMatch) > 1 {
							importPath = importMatch[1]
						}

						report.ImportViolations = append(report.ImportViolations, Violation{
							File:        path,
							Line:        lineNum,
							Type:        "IMPORT",
							Description: vp.description,
							Content:     importPath,
						})
						report.Summary["import_violations"]++
					}
				}
			}
		}
		return nil
	})
}

func checkStorageViolations(dir string, report *ArchitectureReport, verbose bool) {
	// Service-specific store files that should be in packages/ instead
	serviceStorePatterns := []string{
		"store_automation", "store_oracle", "store_gasbank", "store_vrf",
		"store_ccip", "store_cre", "store_datafeeds", "store_datastreams",
		"store_datalink", "store_mixer", "store_confidential", "store_secrets",
		"store_chainlink", "store_functions",
	}

	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		filename := filepath.Base(path)
		for _, pattern := range serviceStorePatterns {
			if strings.Contains(filename, pattern) {
				report.StoreViolations = append(report.StoreViolations, Violation{
					File:        path,
					Line:        0,
					Type:        "STORE",
					Description: "Service-specific store should be in packages/",
					Content:     filename,
				})
				report.Summary["store_violations"]++
			}
		}
		return nil
	})
}

func checkKeywordViolations(dir string, report *ArchitectureReport, verbose bool) {
	// Build regex for service keywords (case insensitive for some)
	keywordPatterns := make([]*regexp.Regexp, 0)
	for _, kw := range serviceKeywords {
		// Match as identifier (word boundary)
		pattern := regexp.MustCompile(`\b` + kw + `\b`)
		keywordPatterns = append(keywordPatterns, pattern)
	}

	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || !strings.HasSuffix(path, ".go") {
			return nil
		}
		// Skip test files
		if strings.HasSuffix(path, "_test.go") {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		lines := strings.Split(string(content), "\n")
		for lineNum, line := range lines {
			// Skip comments and strings for keyword detection
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "//") || strings.HasPrefix(trimmed, "/*") {
				continue
			}

			for i, pattern := range keywordPatterns {
				if pattern.MatchString(line) {
					// Check if it's in a meaningful context (not just a comment)
					keyword := serviceKeywords[i]

					// Skip if it's clearly a generic use
					if isGenericUse(line, keyword) {
						continue
					}

					report.KeywordViolations = append(report.KeywordViolations, Violation{
						File:        path,
						Line:        lineNum + 1,
						Type:        "KEYWORD",
						Description: fmt.Sprintf("Service-specific keyword '%s' in framework code", keyword),
						Content:     strings.TrimSpace(line),
					})
					report.Summary["keyword_violations"]++
				}
			}
		}
		return nil
	})
}

func isGenericUse(line, keyword string) bool {
	// Skip if keyword is in a string literal (likely error message or log)
	if strings.Contains(line, `"`+keyword) || strings.Contains(line, keyword+`"`) {
		return true
	}
	// Skip if it's a comment
	if strings.Contains(line, "//") && strings.Index(line, "//") < strings.Index(line, keyword) {
		return true
	}
	return false
}

func printReport(report *ArchitectureReport) {
	fmt.Println("================================================================================")
	fmt.Println("ARCHITECTURE VIOLATION REPORT")
	fmt.Println("================================================================================")
	fmt.Println()
	fmt.Println("The Service Layer should be a pure 'Service Operating System' that is")
	fmt.Println("completely agnostic to any specific service implementation.")
	fmt.Println()

	totalViolations := len(report.ImportViolations) + len(report.StoreViolations) + len(report.KeywordViolations)

	if totalViolations == 0 {
		fmt.Println("✅ No architecture violations found!")
		return
	}

	fmt.Printf("⚠️  Found %d architecture violations\n\n", totalViolations)

	// Import violations
	if len(report.ImportViolations) > 0 {
		fmt.Println("--------------------------------------------------------------------------------")
		fmt.Printf("IMPORT VIOLATIONS (%d)\n", len(report.ImportViolations))
		fmt.Println("Framework code should NOT import service-specific packages")
		fmt.Println("--------------------------------------------------------------------------------")

		// Group by file
		byFile := make(map[string][]Violation)
		for _, v := range report.ImportViolations {
			byFile[v.File] = append(byFile[v.File], v)
		}

		files := make([]string, 0, len(byFile))
		for f := range byFile {
			files = append(files, f)
		}
		sort.Strings(files)

		for _, file := range files {
			fmt.Printf("\n📁 %s\n", file)
			for _, v := range byFile[file] {
				fmt.Printf("   Line %d: imports %s\n", v.Line, v.Content)
			}
		}
		fmt.Println()
	}

	// Store violations
	if len(report.StoreViolations) > 0 {
		fmt.Println("--------------------------------------------------------------------------------")
		fmt.Printf("STORE VIOLATIONS (%d)\n", len(report.StoreViolations))
		fmt.Println("Service-specific stores should be in packages/, not pkg/storage/")
		fmt.Println("--------------------------------------------------------------------------------")

		for _, v := range report.StoreViolations {
			fmt.Printf("  ❌ %s\n", v.File)
		}
		fmt.Println()
	}

	// Keyword violations (summarized)
	if len(report.KeywordViolations) > 0 {
		fmt.Println("--------------------------------------------------------------------------------")
		fmt.Printf("KEYWORD VIOLATIONS (%d)\n", len(report.KeywordViolations))
		fmt.Println("Service-specific keywords found in framework code")
		fmt.Println("--------------------------------------------------------------------------------")

		// Group by file
		byFile := make(map[string][]Violation)
		for _, v := range report.KeywordViolations {
			byFile[v.File] = append(byFile[v.File], v)
		}

		files := make([]string, 0, len(byFile))
		for f := range byFile {
			files = append(files, f)
		}
		sort.Strings(files)

		for _, file := range files {
			violations := byFile[file]
			fmt.Printf("\n📁 %s (%d violations)\n", file, len(violations))
			// Show first 3 examples per file
			for i, v := range violations {
				if i >= 3 {
					fmt.Printf("   ... and %d more\n", len(violations)-3)
					break
				}
				fmt.Printf("   Line %d: %s\n", v.Line, truncate(v.Content, 60))
			}
		}
		fmt.Println()
	}

	// Summary
	fmt.Println("================================================================================")
	fmt.Println("SUMMARY")
	fmt.Println("================================================================================")
	fmt.Printf("Import violations:  %d\n", len(report.ImportViolations))
	fmt.Printf("Store violations:   %d\n", len(report.StoreViolations))
	fmt.Printf("Keyword violations: %d\n", len(report.KeywordViolations))
	fmt.Printf("Total:              %d\n", totalViolations)
	fmt.Println()
	fmt.Println("RECOMMENDED ACTIONS:")
	fmt.Println("1. Move service-specific stores from pkg/storage/ to packages/")
	fmt.Println("2. Define domain types locally in each service package")
	fmt.Println("3. Replace service-specific types with generic abstractions")
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
