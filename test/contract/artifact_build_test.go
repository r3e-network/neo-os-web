package contract

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var (
	errDotnetMissing = errors.New("dotnet not installed")
	errNCCSMissing   = errors.New("nccs not installed")

	contractBuildMu sync.Mutex
)

func contractArtifactsNeedBuild(contractsRoot, contractName string) (bool, error) {
	nefPath, manifestPath, ok := findContractArtifactsInDir(filepath.Join(contractsRoot, "build"), contractName)
	if !ok {
		return true, nil
	}

	projectDir, err := contractProjectDir(contractsRoot, contractName)
	if err != nil {
		return false, err
	}

	newestSource, hasSource, err := newestContractSourceModTime(projectDir)
	if err != nil {
		return false, err
	}
	if !hasSource {
		return false, nil
	}

	oldestArtifact, err := oldestFileModTime(nefPath, manifestPath)
	if err != nil {
		return false, err
	}

	return newestSource.After(oldestArtifact), nil
}

func compileContractProject(contractsRoot, contractName string) error {
	projectPath, err := contractProjectPath(contractsRoot, contractName)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, resolveNCCSPath(), projectPath, "--optimize=All", "--output", filepath.Join(contractsRoot, "build"))
	cmd.Env = append(os.Environ(), dotnetToolEnv()...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s: %w", strings.TrimSpace(string(out)), err)
	}
	return nil
}

func resolveNCCSPath() string {
	if path, err := exec.LookPath("nccs"); err == nil {
		return path
	}
	home, _ := os.UserHomeDir()
	if home == "" {
		return "nccs"
	}
	return filepath.Join(home, ".dotnet", "tools", "nccs")
}

func findContractArtifactsInDir(buildDir, contractName string) (nefPath, manifestPath string, ok bool) {
	for _, name := range contractArtifactCandidates(contractName) {
		nefPath = filepath.Join(buildDir, name+".nef")
		manifestPath = filepath.Join(buildDir, name+".manifest.json")
		if _, err := os.Stat(nefPath); err != nil {
			continue
		}
		if _, err := os.Stat(manifestPath); err != nil {
			continue
		}
		return nefPath, manifestPath, true
	}

	return "", "", false
}

func contractArtifactCandidates(contractName string) []string {
	contractName = strings.TrimSpace(contractName)
	if contractName == "" {
		return nil
	}

	candidates := []string{contractName}
	if strings.EqualFold(contractName, "MiniAppFactoryV2") {
		candidates = append(candidates, "MiniAppFactory")
	}

	return candidates
}

func contractProjectPath(contractsRoot, contractName string) (string, error) {
	switch {
	case strings.EqualFold(contractName, "MiniAppFactory"), strings.EqualFold(contractName, "MiniAppFactoryV2"):
		return filepath.Join(contractsRoot, "MiniAppFactoryV2", "MiniAppFactoryV2.csproj"), nil
	case strings.EqualFold(contractName, "MiniAppTemplate"), strings.HasPrefix(strings.ToLower(contractName), "miniapptemplate."):
		return filepath.Join(contractsRoot, "MiniAppTemplates", "MiniAppTemplates.csproj"), nil
	default:
		return filepath.Join(contractsRoot, contractName, contractName+".csproj"), nil
	}
}

func contractProjectDir(contractsRoot, contractName string) (string, error) {
	projectPath, err := contractProjectPath(contractsRoot, contractName)
	if err != nil {
		return "", err
	}
	return filepath.Dir(projectPath), nil
}

func newestContractSourceModTime(contractsRoot string) (time.Time, bool, error) {
	var newest time.Time
	var found bool

	err := filepath.WalkDir(contractsRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if shouldSkipContractSourceDir(d.Name()) {
				return filepath.SkipDir
			}
			return nil
		}
		if !isTrackedContractSourceFile(path) {
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return err
		}
		if !found || info.ModTime().After(newest) {
			newest = info.ModTime()
			found = true
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return time.Time{}, false, nil
		}
		return time.Time{}, false, err
	}

	return newest, found, nil
}

func oldestFileModTime(paths ...string) (time.Time, error) {
	var oldest time.Time
	for i, path := range paths {
		info, err := os.Stat(path)
		if err != nil {
			return time.Time{}, err
		}
		if i == 0 || info.ModTime().Before(oldest) {
			oldest = info.ModTime()
		}
	}
	return oldest, nil
}

func shouldSkipContractSourceDir(name string) bool {
	switch name {
	case "build", "bin", "obj":
		return true
	default:
		return strings.HasPrefix(name, ".")
	}
}

func isTrackedContractSourceFile(path string) bool {
	base := filepath.Base(path)
	if base == "build.sh" {
		return true
	}

	for _, suffix := range []string{".cs", ".csproj", ".props", ".targets"} {
		if strings.HasSuffix(path, suffix) {
			return true
		}
	}

	return false
}
