package contract

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestContractArtifactsNeedBuild(t *testing.T) {
	baseTime := time.Date(2026, time.March, 6, 10, 0, 0, 0, time.UTC)

	t.Run("uses artifact when present and fresh", func(t *testing.T) {
		contractsRoot := t.TempDir()
		writeFileWithTime(t, filepath.Join(contractsRoot, "Governance", "Governance.cs"), baseTime)
		writeFileWithTime(t, filepath.Join(contractsRoot, "build", "Governance.nef"), baseTime.Add(time.Minute))
		writeFileWithTime(t, filepath.Join(contractsRoot, "build", "Governance.manifest.json"), baseTime.Add(time.Minute))

		needsBuild, err := contractArtifactsNeedBuild(contractsRoot, "Governance")
		require.NoError(t, err)
		require.False(t, needsBuild)
	})

	t.Run("builds when requested artifact is missing", func(t *testing.T) {
		contractsRoot := t.TempDir()
		writeFileWithTime(t, filepath.Join(contractsRoot, "MiniAppTemplates", "Template.Lottery.cs"), baseTime)
		writeFileWithTime(t, filepath.Join(contractsRoot, "build", "Governance.nef"), baseTime.Add(time.Minute))
		writeFileWithTime(t, filepath.Join(contractsRoot, "build", "Governance.manifest.json"), baseTime.Add(time.Minute))

		needsBuild, err := contractArtifactsNeedBuild(contractsRoot, "MiniAppTemplate.Lottery")
		require.NoError(t, err)
		require.True(t, needsBuild)
	})

	t.Run("builds when contract sources are newer than artifacts", func(t *testing.T) {
		contractsRoot := t.TempDir()
		writeFileWithTime(t, filepath.Join(contractsRoot, "MiniAppTemplates", "MiniAppTemplate.Base.cs"), baseTime.Add(2*time.Minute))
		writeFileWithTime(t, filepath.Join(contractsRoot, "build", "MiniAppTemplate.Lottery.nef"), baseTime)
		writeFileWithTime(t, filepath.Join(contractsRoot, "build", "MiniAppTemplate.Lottery.manifest.json"), baseTime)

		needsBuild, err := contractArtifactsNeedBuild(contractsRoot, "MiniAppTemplate.Lottery")
		require.NoError(t, err)
		require.True(t, needsBuild)
	})

	t.Run("ignores generated bin and obj sources", func(t *testing.T) {
		contractsRoot := t.TempDir()
		writeFileWithTime(t, filepath.Join(contractsRoot, "MiniAppTemplates", "MiniAppTemplate.Base.cs"), baseTime)
		writeFileWithTime(t, filepath.Join(contractsRoot, "MiniAppTemplates", "bin", "Debug", "Generated.cs"), baseTime.Add(3*time.Minute))
		writeFileWithTime(t, filepath.Join(contractsRoot, "MiniAppTemplates", "obj", "Debug", "Generated.cs"), baseTime.Add(4*time.Minute))
		writeFileWithTime(t, filepath.Join(contractsRoot, "build", "MiniAppTemplate.Lottery.nef"), baseTime.Add(time.Minute))
		writeFileWithTime(t, filepath.Join(contractsRoot, "build", "MiniAppTemplate.Lottery.manifest.json"), baseTime.Add(time.Minute))

		needsBuild, err := contractArtifactsNeedBuild(contractsRoot, "MiniAppTemplate.Lottery")
		require.NoError(t, err)
		require.False(t, needsBuild)
	})

	t.Run("ignores newer changes in unrelated contract projects", func(t *testing.T) {
		contractsRoot := t.TempDir()
		writeFileWithTime(t, filepath.Join(contractsRoot, "Governance", "Governance.cs"), baseTime)
		writeFileWithTime(t, filepath.Join(contractsRoot, "MiniAppTemplates", "MiniAppTemplate.Base.cs"), baseTime.Add(5*time.Minute))
		writeFileWithTime(t, filepath.Join(contractsRoot, "build", "Governance.nef"), baseTime.Add(time.Minute))
		writeFileWithTime(t, filepath.Join(contractsRoot, "build", "Governance.manifest.json"), baseTime.Add(time.Minute))

		needsBuild, err := contractArtifactsNeedBuild(contractsRoot, "Governance")
		require.NoError(t, err)
		require.False(t, needsBuild)
	})
}

func writeFileWithTime(t *testing.T, path string, modTime time.Time) {
	t.Helper()
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))
	require.NoError(t, os.WriteFile(path, []byte("test"), 0o644))
	require.NoError(t, os.Chtimes(path, modTime, modTime))
}
