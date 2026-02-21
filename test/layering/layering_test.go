package layering

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"testing"
)

type goListPackage struct {
	ImportPath string   `json:"ImportPath"`
	Imports    []string `json:"Imports"`
}

func TestLayeringBoundaries(t *testing.T) {
	root := repoRoot(t)
	modulePath := readModulePath(t, root)

	pkgs := goListPackages(t, root)

	var violations []string

	for _, pkg := range pkgs {
		if !strings.HasPrefix(pkg.ImportPath, modulePath) {
			continue
		}

		// Test-only packages are allowed to compose any modules.
		if strings.Contains(pkg.ImportPath, modulePath+"/test/") {
			continue
		}

		// Entrypoints and deploy tooling are composition roots by design.
		if strings.Contains(pkg.ImportPath, modulePath+"/cmd/") || strings.Contains(pkg.ImportPath, modulePath+"/deploy/") {
			continue
		}

		switch {
		case strings.HasPrefix(pkg.ImportPath, modulePath+"/services/"):
			serviceName := serviceRoot(modulePath, pkg.ImportPath)
			if serviceName == "" {
				continue
			}

			for _, imp := range pkg.Imports {
				if !strings.HasPrefix(imp, modulePath) {
					continue
				}

				// Services may depend on shared infrastructure.
				if strings.HasPrefix(imp, modulePath+"/infrastructure/") {
					continue
				}

				// Services may depend on other packages within the same service root.
				svcPrefix := modulePath + "/services/" + serviceName
				if imp == svcPrefix || strings.HasPrefix(imp, svcPrefix+"/") {
					continue
				}

				violations = append(violations, fmt.Sprintf("%s imports %s (services may only import infrastructure or same-service packages)", pkg.ImportPath, imp))
			}

		case strings.HasPrefix(pkg.ImportPath, modulePath+"/infrastructure/"):
			for _, imp := range pkg.Imports {
				if !strings.HasPrefix(imp, modulePath) {
					continue
				}

				// Infrastructure must not depend on higher layers.
				if strings.HasPrefix(imp, modulePath+"/infrastructure/") {
					continue
				}

				violations = append(violations, fmt.Sprintf("%s imports %s (infrastructure must not import services/cmd/platform layers)", pkg.ImportPath, imp))
			}
		}
	}

	if len(violations) == 0 {
		return
	}

	sort.Strings(violations)
	t.Fatalf("layering violations (%d):\n%s", len(violations), strings.Join(violations, "\n"))
}

func serviceRoot(modulePath, importPath string) string {
	prefix := modulePath + "/services/"
	if !strings.HasPrefix(importPath, prefix) {
		return ""
	}
	rest := strings.TrimPrefix(importPath, prefix)
	parts := strings.Split(rest, "/")
	if len(parts) == 0 {
		return ""
	}
	return strings.TrimSpace(parts[0])
}

func repoRoot(t *testing.T) string {
	t.Helper()

	_, thisFile, _, ok := runtime.Caller(0)
	if !ok || strings.TrimSpace(thisFile) == "" {
		t.Fatal("failed to determine test file path")
	}

	dir := filepath.Dir(thisFile)
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatalf("could not find repo root (go.mod) from %s", thisFile)
		}
		dir = parent
	}
}

func readModulePath(t *testing.T, root string) string {
	t.Helper()

	f, err := os.Open(filepath.Join(root, "go.mod"))
	if err != nil {
		t.Fatalf("open go.mod: %v", err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "module ") {
			return strings.TrimSpace(strings.TrimPrefix(line, "module "))
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scan go.mod: %v", err)
	}
	t.Fatal("module path not found in go.mod")
	return ""
}

func goListPackages(t *testing.T, root string) []goListPackage {
	t.Helper()

	cmd := exec.Command("go", "list", "-json", "./...")
	cmd.Dir = root

	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("go list failed: %s: %v", strings.TrimSpace(string(out)), err)
	}

	decoder := json.NewDecoder(bytes.NewReader(out))
	pkgs := make([]goListPackage, 0, 128)
	for {
		var pkg goListPackage
		if err := decoder.Decode(&pkg); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			t.Fatalf("decode go list output: %v", err)
		}
		if strings.TrimSpace(pkg.ImportPath) == "" {
			continue
		}
		pkgs = append(pkgs, pkg)
	}

	return pkgs
}
