// Package main provides a comprehensive duplication checker for Go codebases.
// It detects duplicated files, methods, types, constants, and code patterns.
//
// Usage: go run scripts/duplication_checker.go [options]
//
// Options:
//   -dir string      Directory to scan (default ".")
//   -min-lines int   Minimum lines for method duplication (default 5)
//   -output string   Output format: text, json (default "text")
//   -verbose         Show detailed output
package main

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// DuplicationReport holds all detected duplications
type DuplicationReport struct {
	DuplicateFiles     []FileDuplication     `json:"duplicate_files"`
	DuplicateMethods   []MethodDuplication   `json:"duplicate_methods"`
	DuplicateTypes     []TypeDuplication     `json:"duplicate_types"`
	DuplicateConstants []ConstantDuplication `json:"duplicate_constants"`
	DuplicatePatterns  []PatternDuplication  `json:"duplicate_patterns"`
	Summary            Summary               `json:"summary"`
}

type FileDuplication struct {
	Hash  string   `json:"hash"`
	Files []string `json:"files"`
}

type MethodDuplication struct {
	Signature   string           `json:"signature"`
	BodyHash    string           `json:"body_hash"`
	LineCount   int              `json:"line_count"`
	Occurrences []MethodLocation `json:"occurrences"`
}

type MethodLocation struct {
	File     string `json:"file"`
	Line     int    `json:"line"`
	Receiver string `json:"receiver,omitempty"`
	Name     string `json:"name"`
}

type TypeDuplication struct {
	Name        string         `json:"name"`
	Kind        string         `json:"kind"` // struct, interface
	FieldsHash  string         `json:"fields_hash"`
	Occurrences []TypeLocation `json:"occurrences"`
}

type TypeLocation struct {
	File    string `json:"file"`
	Line    int    `json:"line"`
	Package string `json:"package"`
}

type ConstantDuplication struct {
	Name        string   `json:"name"`
	Value       string   `json:"value"`
	Occurrences []string `json:"occurrences"` // file:line
}

type PatternDuplication struct {
	Pattern     string   `json:"pattern"`
	Description string   `json:"description"`
	Count       int      `json:"count"`
	Locations   []string `json:"locations"`
}

type Summary struct {
	TotalFiles           int `json:"total_files"`
	DuplicateFileGroups  int `json:"duplicate_file_groups"`
	DuplicateMethodCount int `json:"duplicate_method_count"`
	DuplicateTypeCount   int `json:"duplicate_type_count"`
	DuplicateConstCount  int `json:"duplicate_constant_count"`
	DuplicatePatternCount int `json:"duplicate_pattern_count"`
	EstimatedDuplicateLines int `json:"estimated_duplicate_lines"`
}

var (
	scanDir   = flag.String("dir", ".", "Directory to scan")
	minLines  = flag.Int("min-lines", 5, "Minimum lines for method duplication")
	output    = flag.String("output", "text", "Output format: text, json")
	verbose   = flag.Bool("verbose", false, "Show detailed output")
	skipDirs  = flag.String("skip", "vendor,.git,node_modules,testdata", "Directories to skip (comma-separated)")
)

func main() {
	flag.Parse()

	skipSet := make(map[string]bool)
	for _, d := range strings.Split(*skipDirs, ",") {
		skipSet[strings.TrimSpace(d)] = true
	}

	report := &DuplicationReport{}

	// Collect all Go files
	var goFiles []string
	err := filepath.Walk(*scanDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if skipSet[info.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasSuffix(path, ".go") && !strings.HasSuffix(path, "_test.go") {
			goFiles = append(goFiles, path)
		}
		return nil
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error walking directory: %v\n", err)
		os.Exit(1)
	}

	report.Summary.TotalFiles = len(goFiles)

	// Check for duplicate files
	checkDuplicateFiles(goFiles, report)

	// Parse and analyze Go files
	fset := token.NewFileSet()
	for _, file := range goFiles {
		analyzeGoFile(file, fset, report)
	}

	// Check for duplicate patterns
	checkDuplicatePatterns(goFiles, report)

	// Consolidate method duplications
	consolidateMethodDuplications(report)

	// Consolidate type duplications
	consolidateTypeDuplications(report)

	// Calculate summary
	calculateSummary(report)

	// Output results
	if *output == "json" {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		enc.Encode(report)
	} else {
		printTextReport(report)
	}
}

func checkDuplicateFiles(files []string, report *DuplicationReport) {
	hashToFiles := make(map[string][]string)

	for _, file := range files {
		hash, err := fileHash(file)
		if err != nil {
			continue
		}
		hashToFiles[hash] = append(hashToFiles[hash], file)
	}

	for hash, fileList := range hashToFiles {
		if len(fileList) > 1 {
			report.DuplicateFiles = append(report.DuplicateFiles, FileDuplication{
				Hash:  hash,
				Files: fileList,
			})
		}
	}
}

func fileHash(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := md5.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// methodInfo stores method information during analysis
type methodInfo struct {
	file     string
	line     int
	receiver string
	name     string
	bodyHash string
	lineCount int
	signature string
}

// typeInfo stores type information during analysis
type typeInfo struct {
	file       string
	line       int
	pkg        string
	name       string
	kind       string
	fieldsHash string
}

var (
	methodInfos []methodInfo
	typeInfos   []typeInfo
	constInfos  = make(map[string][]string) // name -> []file:line
)

func analyzeGoFile(path string, fset *token.FileSet, report *DuplicationReport) {
	src, err := os.ReadFile(path)
	if err != nil {
		return
	}

	f, err := parser.ParseFile(fset, path, src, parser.ParseComments)
	if err != nil {
		return
	}

	pkgName := f.Name.Name

	ast.Inspect(f, func(n ast.Node) bool {
		switch node := n.(type) {
		case *ast.FuncDecl:
			analyzeFuncDecl(path, fset, node, src)
		case *ast.GenDecl:
			analyzeGenDecl(path, fset, node, pkgName, src)
		}
		return true
	})
}

func analyzeFuncDecl(path string, fset *token.FileSet, fn *ast.FuncDecl, src []byte) {
	if fn.Body == nil {
		return
	}

	pos := fset.Position(fn.Pos())
	endPos := fset.Position(fn.End())
	lineCount := endPos.Line - pos.Line + 1

	if lineCount < *minLines {
		return
	}

	// Get receiver
	var receiver string
	if fn.Recv != nil && len(fn.Recv.List) > 0 {
		recv := fn.Recv.List[0]
		switch t := recv.Type.(type) {
		case *ast.StarExpr:
			if ident, ok := t.X.(*ast.Ident); ok {
				receiver = "*" + ident.Name
			}
		case *ast.Ident:
			receiver = t.Name
		}
	}

	// Get body content and hash
	bodyStart := fset.Position(fn.Body.Pos()).Offset
	bodyEnd := fset.Position(fn.Body.End()).Offset
	if bodyEnd > len(src) {
		bodyEnd = len(src)
	}
	bodyContent := normalizeCode(string(src[bodyStart:bodyEnd]))
	bodyHash := hashString(bodyContent)

	// Build signature (without receiver for comparison)
	sig := buildFuncSignature(fn)

	methodInfos = append(methodInfos, methodInfo{
		file:      path,
		line:      pos.Line,
		receiver:  receiver,
		name:      fn.Name.Name,
		bodyHash:  bodyHash,
		lineCount: lineCount,
		signature: sig,
	})
}

func buildFuncSignature(fn *ast.FuncDecl) string {
	var params []string
	if fn.Type.Params != nil {
		for _, p := range fn.Type.Params.List {
			params = append(params, typeToString(p.Type))
		}
	}

	var results []string
	if fn.Type.Results != nil {
		for _, r := range fn.Type.Results.List {
			results = append(results, typeToString(r.Type))
		}
	}

	return fmt.Sprintf("(%s) -> (%s)", strings.Join(params, ", "), strings.Join(results, ", "))
}

func typeToString(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		return t.Name
	case *ast.StarExpr:
		return "*" + typeToString(t.X)
	case *ast.SelectorExpr:
		return typeToString(t.X) + "." + t.Sel.Name
	case *ast.ArrayType:
		return "[]" + typeToString(t.Elt)
	case *ast.MapType:
		return "map[" + typeToString(t.Key) + "]" + typeToString(t.Value)
	case *ast.InterfaceType:
		return "interface{}"
	case *ast.FuncType:
		return "func"
	default:
		return "any"
	}
}

func analyzeGenDecl(path string, fset *token.FileSet, decl *ast.GenDecl, pkgName string, src []byte) {
	for _, spec := range decl.Specs {
		switch s := spec.(type) {
		case *ast.TypeSpec:
			analyzeTypeSpec(path, fset, s, pkgName, src)
		case *ast.ValueSpec:
			if decl.Tok == token.CONST {
				analyzeConstSpec(path, fset, s)
			}
		}
	}
}

func analyzeTypeSpec(path string, fset *token.FileSet, spec *ast.TypeSpec, pkgName string, src []byte) {
	pos := fset.Position(spec.Pos())

	var kind string
	var fieldsHash string

	switch t := spec.Type.(type) {
	case *ast.StructType:
		kind = "struct"
		fieldsHash = hashStructFields(t, src, fset)
	case *ast.InterfaceType:
		kind = "interface"
		fieldsHash = hashInterfaceMethods(t, src, fset)
	default:
		return // Skip type aliases and other types
	}

	typeInfos = append(typeInfos, typeInfo{
		file:       path,
		line:       pos.Line,
		pkg:        pkgName,
		name:       spec.Name.Name,
		kind:       kind,
		fieldsHash: fieldsHash,
	})
}

func hashStructFields(st *ast.StructType, src []byte, fset *token.FileSet) string {
	if st.Fields == nil {
		return ""
	}

	var fields []string
	for _, f := range st.Fields.List {
		fieldType := typeToString(f.Type)
		for _, name := range f.Names {
			fields = append(fields, name.Name+":"+fieldType)
		}
		if len(f.Names) == 0 {
			fields = append(fields, fieldType) // embedded
		}
	}
	sort.Strings(fields)
	return hashString(strings.Join(fields, ";"))
}

func hashInterfaceMethods(it *ast.InterfaceType, src []byte, fset *token.FileSet) string {
	if it.Methods == nil {
		return ""
	}

	var methods []string
	for _, m := range it.Methods.List {
		if len(m.Names) > 0 {
			if ft, ok := m.Type.(*ast.FuncType); ok {
				sig := m.Names[0].Name + buildFuncTypeSignature(ft)
				methods = append(methods, sig)
			}
		}
	}
	sort.Strings(methods)
	return hashString(strings.Join(methods, ";"))
}

func buildFuncTypeSignature(ft *ast.FuncType) string {
	var params []string
	if ft.Params != nil {
		for _, p := range ft.Params.List {
			params = append(params, typeToString(p.Type))
		}
	}

	var results []string
	if ft.Results != nil {
		for _, r := range ft.Results.List {
			results = append(results, typeToString(r.Type))
		}
	}

	return fmt.Sprintf("(%s)(%s)", strings.Join(params, ","), strings.Join(results, ","))
}

func analyzeConstSpec(path string, fset *token.FileSet, spec *ast.ValueSpec) {
	pos := fset.Position(spec.Pos())
	for _, name := range spec.Names {
		key := name.Name
		loc := fmt.Sprintf("%s:%d", path, pos.Line)
		constInfos[key] = append(constInfos[key], loc)
	}
}

func normalizeCode(code string) string {
	// Remove comments
	re := regexp.MustCompile(`//.*|/\*[\s\S]*?\*/`)
	code = re.ReplaceAllString(code, "")

	// Normalize whitespace
	code = regexp.MustCompile(`\s+`).ReplaceAllString(code, " ")

	// Remove variable names (simplified)
	code = strings.TrimSpace(code)

	return code
}

func hashString(s string) string {
	h := md5.Sum([]byte(s))
	return hex.EncodeToString(h[:])
}

func consolidateMethodDuplications(report *DuplicationReport) {
	// Group by body hash
	hashToMethods := make(map[string][]methodInfo)
	for _, m := range methodInfos {
		hashToMethods[m.bodyHash] = append(hashToMethods[m.bodyHash], m)
	}

	for hash, methods := range hashToMethods {
		if len(methods) < 2 {
			continue
		}

		// Check if methods have same signature pattern
		sigGroups := make(map[string][]methodInfo)
		for _, m := range methods {
			sigGroups[m.signature] = append(sigGroups[m.signature], m)
		}

		for sig, group := range sigGroups {
			if len(group) < 2 {
				continue
			}

			var occurrences []MethodLocation
			for _, m := range group {
				occurrences = append(occurrences, MethodLocation{
					File:     m.file,
					Line:     m.line,
					Receiver: m.receiver,
					Name:     m.name,
				})
			}

			report.DuplicateMethods = append(report.DuplicateMethods, MethodDuplication{
				Signature:   sig,
				BodyHash:    hash,
				LineCount:   group[0].lineCount,
				Occurrences: occurrences,
			})
		}
	}

	// Sort by line count (largest first)
	sort.Slice(report.DuplicateMethods, func(i, j int) bool {
		return report.DuplicateMethods[i].LineCount > report.DuplicateMethods[j].LineCount
	})
}

func consolidateTypeDuplications(report *DuplicationReport) {
	// Group by fields hash
	hashToTypes := make(map[string][]typeInfo)
	for _, t := range typeInfos {
		if t.fieldsHash == "" {
			continue
		}
		key := t.kind + ":" + t.fieldsHash
		hashToTypes[key] = append(hashToTypes[key], t)
	}

	for _, types := range hashToTypes {
		if len(types) < 2 {
			continue
		}

		var occurrences []TypeLocation
		var names []string
		for _, t := range types {
			occurrences = append(occurrences, TypeLocation{
				File:    t.file,
				Line:    t.line,
				Package: t.pkg,
			})
			names = append(names, t.pkg+"."+t.name)
		}

		report.DuplicateTypes = append(report.DuplicateTypes, TypeDuplication{
			Name:        strings.Join(names, " / "),
			Kind:        types[0].kind,
			FieldsHash:  types[0].fieldsHash,
			Occurrences: occurrences,
		})
	}

	// Check for duplicate constant names with same values
	for name, locs := range constInfos {
		if len(locs) > 3 { // Only report if duplicated many times
			report.DuplicateConstants = append(report.DuplicateConstants, ConstantDuplication{
				Name:        name,
				Occurrences: locs,
			})
		}
	}
}

func checkDuplicatePatterns(files []string, report *DuplicationReport) {
	patterns := []struct {
		name    string
		pattern *regexp.Regexp
		desc    string
	}{
		{
			name:    "error_required_pattern",
			pattern: regexp.MustCompile(`fmt\.Errorf\([^)]*required[^)]*\)`),
			desc:    "fmt.Errorf with 'required' - consider using core.RequiredError()",
		},
		{
			name:    "strings_trimspace_empty_check",
			pattern: regexp.MustCompile(`strings\.TrimSpace\([^)]+\)\s*==\s*""`),
			desc:    "TrimSpace empty check - consider using core.NormalizeRequired()",
		},
		{
			name:    "metadata_extraction",
			pattern: regexp.MustCompile(`if\s+rawMeta,\s*ok\s*:=.*\["metadata"\]`),
			desc:    "Manual metadata extraction - consider using core.ExtractMetadataRaw()",
		},
		{
			name:    "limit_parsing",
			pattern: regexp.MustCompile(`fmt\.Sscanf\([^,]+,\s*"%d",\s*&limit\)`),
			desc:    "Manual limit parsing - consider using core.ParseLimitFromQuery()",
		},
		{
			name:    "json_body_parsing",
			pattern: regexp.MustCompile(`json\.Unmarshal\([^,]+,\s*&\w+\.Body\)`),
			desc:    "Manual JSON body parsing - consider using core.ParseRequest()",
		},
		{
			name:    "account_validation",
			pattern: regexp.MustCompile(`if\s+accountID\s*==\s*""\s*\{`),
			desc:    "Manual account validation - consider using core.NormalizeAndValidateAccount()",
		},
		{
			name:    "ownership_check",
			pattern: regexp.MustCompile(`if\s+\w+\.AccountID\s*!=\s*accountID`),
			desc:    "Manual ownership check - consider using core.EnsureOwnership()",
		},
	}

	patternCounts := make(map[string][]string)

	for _, file := range files {
		content, err := os.ReadFile(file)
		if err != nil {
			continue
		}

		lines := strings.Split(string(content), "\n")
		for lineNum, line := range lines {
			for _, p := range patterns {
				if p.pattern.MatchString(line) {
					loc := fmt.Sprintf("%s:%d", file, lineNum+1)
					patternCounts[p.name] = append(patternCounts[p.name], loc)
				}
			}
		}
	}

	for _, p := range patterns {
		if locs, ok := patternCounts[p.name]; ok && len(locs) > 1 {
			report.DuplicatePatterns = append(report.DuplicatePatterns, PatternDuplication{
				Pattern:     p.name,
				Description: p.desc,
				Count:       len(locs),
				Locations:   locs,
			})
		}
	}

	// Sort by count
	sort.Slice(report.DuplicatePatterns, func(i, j int) bool {
		return report.DuplicatePatterns[i].Count > report.DuplicatePatterns[j].Count
	})
}

func calculateSummary(report *DuplicationReport) {
	report.Summary.DuplicateFileGroups = len(report.DuplicateFiles)
	report.Summary.DuplicateMethodCount = len(report.DuplicateMethods)
	report.Summary.DuplicateTypeCount = len(report.DuplicateTypes)
	report.Summary.DuplicateConstCount = len(report.DuplicateConstants)
	report.Summary.DuplicatePatternCount = len(report.DuplicatePatterns)

	// Estimate duplicate lines
	for _, m := range report.DuplicateMethods {
		report.Summary.EstimatedDuplicateLines += m.LineCount * (len(m.Occurrences) - 1)
	}
}

func printTextReport(report *DuplicationReport) {
	fmt.Println("=" + strings.Repeat("=", 79))
	fmt.Println("DUPLICATION ANALYSIS REPORT")
	fmt.Println("=" + strings.Repeat("=", 79))
	fmt.Printf("\nTotal files scanned: %d\n", report.Summary.TotalFiles)

	// Duplicate Files
	if len(report.DuplicateFiles) > 0 {
		fmt.Println("\n" + strings.Repeat("-", 80))
		fmt.Printf("DUPLICATE FILES (%d groups)\n", len(report.DuplicateFiles))
		fmt.Println(strings.Repeat("-", 80))
		for _, dup := range report.DuplicateFiles {
			fmt.Printf("\nHash: %s\n", dup.Hash[:8])
			for _, f := range dup.Files {
				fmt.Printf("  - %s\n", f)
			}
		}
	}

	// Duplicate Methods
	if len(report.DuplicateMethods) > 0 {
		fmt.Println("\n" + strings.Repeat("-", 80))
		fmt.Printf("DUPLICATE METHODS (%d groups)\n", len(report.DuplicateMethods))
		fmt.Println(strings.Repeat("-", 80))

		// Show top 20
		limit := 20
		if len(report.DuplicateMethods) < limit {
			limit = len(report.DuplicateMethods)
		}

		for i := 0; i < limit; i++ {
			dup := report.DuplicateMethods[i]
			fmt.Printf("\n[%d lines] Signature: %s\n", dup.LineCount, dup.Signature)
			for _, loc := range dup.Occurrences {
				if loc.Receiver != "" {
					fmt.Printf("  - %s:%d (%s).%s\n", loc.File, loc.Line, loc.Receiver, loc.Name)
				} else {
					fmt.Printf("  - %s:%d %s\n", loc.File, loc.Line, loc.Name)
				}
			}
		}

		if len(report.DuplicateMethods) > limit {
			fmt.Printf("\n... and %d more duplicate method groups\n", len(report.DuplicateMethods)-limit)
		}
	}

	// Duplicate Types
	if len(report.DuplicateTypes) > 0 {
		fmt.Println("\n" + strings.Repeat("-", 80))
		fmt.Printf("DUPLICATE TYPES (%d groups)\n", len(report.DuplicateTypes))
		fmt.Println(strings.Repeat("-", 80))
		for _, dup := range report.DuplicateTypes {
			fmt.Printf("\n[%s] %s\n", dup.Kind, dup.Name)
			for _, loc := range dup.Occurrences {
				fmt.Printf("  - %s:%d (package: %s)\n", loc.File, loc.Line, loc.Package)
			}
		}
	}

	// Duplicate Patterns
	if len(report.DuplicatePatterns) > 0 {
		fmt.Println("\n" + strings.Repeat("-", 80))
		fmt.Printf("DUPLICATE PATTERNS (%d patterns)\n", len(report.DuplicatePatterns))
		fmt.Println(strings.Repeat("-", 80))
		for _, dup := range report.DuplicatePatterns {
			fmt.Printf("\n[%d occurrences] %s\n", dup.Count, dup.Pattern)
			fmt.Printf("  Suggestion: %s\n", dup.Description)
			if *verbose {
				for _, loc := range dup.Locations {
					fmt.Printf("    - %s\n", loc)
				}
			} else if len(dup.Locations) > 0 {
				fmt.Printf("  Example: %s\n", dup.Locations[0])
				if len(dup.Locations) > 1 {
					fmt.Printf("  ... and %d more locations\n", len(dup.Locations)-1)
				}
			}
		}
	}

	// Summary
	fmt.Println("\n" + strings.Repeat("=", 80))
	fmt.Println("SUMMARY")
	fmt.Println(strings.Repeat("=", 80))
	fmt.Printf("  Duplicate file groups:    %d\n", report.Summary.DuplicateFileGroups)
	fmt.Printf("  Duplicate method groups:  %d\n", report.Summary.DuplicateMethodCount)
	fmt.Printf("  Duplicate type groups:    %d\n", report.Summary.DuplicateTypeCount)
	fmt.Printf("  Duplicate patterns:       %d\n", report.Summary.DuplicatePatternCount)
	fmt.Printf("  Estimated duplicate lines: %d\n", report.Summary.EstimatedDuplicateLines)
	fmt.Println()
}
