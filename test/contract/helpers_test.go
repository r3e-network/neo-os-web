package contract

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func findRepoRoot() (string, error) {
	candidates := []string{}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates, wd)
	}
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Dir(exe))
	}

	for _, start := range candidates {
		current := filepath.Clean(start)
		for i := 0; i < 16; i++ {
			if _, err := os.Stat(filepath.Join(current, "contracts")); err == nil {
				return current, nil
			}
			parent := filepath.Dir(current)
			if parent == current {
				break
			}
			current = parent
		}
	}

	return "", errors.New("could not locate repository root containing contracts/")
}

func dotnetToolEnv() []string {
	return []string{}
}

func FindContractArtifacts(contractName string) (string, string, error) {
	repoRoot, err := findRepoRoot()
	if err != nil {
		return "", "", err
	}
	contractsRoot := filepath.Join(repoRoot, "contracts")

	contractBuildMu.Lock()
	defer contractBuildMu.Unlock()

	if !hasDotnet() {
		return "", "", errDotnetMissing
	}
	if _, err := os.Stat(resolveNCCSPath()); err != nil {
		if _, lookPathErr := exec.LookPath("nccs"); lookPathErr != nil {
			return "", "", errNCCSMissing
		}
	}

	needsBuild, err := contractArtifactsNeedBuild(contractsRoot, contractName)
	if err != nil {
		return "", "", err
	}
	if needsBuild {
		if err := compileContractProject(contractsRoot, contractName); err != nil {
			return "", "", err
		}
	}

	nefPath, manifestPath, ok := findContractArtifactsInDir(filepath.Join(contractsRoot, "build"), contractName)
	if !ok {
		return "", "", errors.New("contract artifacts not found")
	}
	return nefPath, manifestPath, nil
}

func SkipIfNoCompiledContracts(t *testing.T) {
	t.Helper()

	if _, _, err := FindContractArtifacts("Governance"); err != nil {
		switch {
		case errors.Is(err, errDotnetMissing):
			t.Skip("dotnet not installed; install .NET SDK/runtime and re-run")
		case errors.Is(err, errNCCSMissing):
			t.Skip("nccs not installed; run 'dotnet tool install -g Neo.Compiler.CSharp'")
		case looksLikeMissingDotnetRuntime(err.Error()):
			t.Skipf("contracts build requires an additional .NET runtime: %v", err)
		default:
			t.Fatalf("contracts build failed: %v", err)
		}
	}
}

func hasDotnet() bool {
	if _, err := exec.LookPath("dotnet"); err == nil {
		return true
	}
	home, _ := os.UserHomeDir()
	if home == "" {
		return false
	}
	_, err := os.Stat(filepath.Join(home, ".dotnet", "dotnet"))
	return err == nil
}

func looksLikeMissingDotnetRuntime(output string) bool {
	candidates := []string{
		"You must install or update .NET to run this application.",
		"framework: 'Microsoft.NETCore.App'",
		"aka.ms/dotnet/app-launch-failed",
		"To install missing framework, download:",
	}
	for _, candidate := range candidates {
		if strings.Contains(output, candidate) {
			return true
		}
	}
	return false
}
