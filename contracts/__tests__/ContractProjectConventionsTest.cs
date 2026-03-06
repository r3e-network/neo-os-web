using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class ContractProjectConventionsTest
    {
        [Fact]
        public void ContractProjectsUseSharedBuildDefaults()
        {
            string repoRoot = ContractSourceAssertions.FindRepoRoot();
            string contractsRoot = Path.Combine(repoRoot, "contracts");
            string sharedPropsPath = Path.Combine(contractsRoot, "Directory.Build.props");

            Assert.True(File.Exists(sharedPropsPath), $"Expected shared build props file at {sharedPropsPath}");

            string sharedProps = File.ReadAllText(sharedPropsPath);
            Assert.Contains("<TargetFramework", sharedProps, StringComparison.Ordinal);
            Assert.Contains("net10.0</TargetFramework>", sharedProps, StringComparison.Ordinal);
            Assert.Contains("<Nullable", sharedProps, StringComparison.Ordinal);
            Assert.Contains("enable</Nullable>", sharedProps, StringComparison.Ordinal);
            Assert.Contains("<Optimize", sharedProps, StringComparison.Ordinal);
            Assert.Contains("true</Optimize>", sharedProps, StringComparison.Ordinal);
            Assert.Contains("Neo.SmartContract.Framework", sharedProps, StringComparison.Ordinal);

            List<string> offenders = Directory
                .GetFiles(contractsRoot, "*.csproj", SearchOption.AllDirectories)
                .Select(path => new
                {
                    RelativePath = Path.GetRelativePath(repoRoot, path),
                    Contents = File.ReadAllText(path)
                })
                .Where(project =>
                    project.Contents.Contains("\\", StringComparison.Ordinal) ||
                    project.Contents.Contains("<TargetFramework>", StringComparison.Ordinal) ||
                    project.Contents.Contains("<Nullable>", StringComparison.Ordinal) ||
                    project.Contents.Contains("<Optimize>", StringComparison.Ordinal) ||
                    project.Contents.Contains("Neo.SmartContract.Framework", StringComparison.Ordinal))
                .Select(project => project.RelativePath)
                .OrderBy(path => path, StringComparer.Ordinal)
                .ToList();

            Assert.True(
                offenders.Count == 0,
                $"Contract project files should rely on shared defaults. Offenders: {string.Join(", ", offenders)}");
        }


        [Fact]
        public void ContractProjectsDoNotUseWildcardCompileIncludes()
        {
            string repoRoot = ContractSourceAssertions.FindRepoRoot();
            string contractsRoot = Path.Combine(repoRoot, "contracts");

            List<string> offenders = Directory
                .GetFiles(contractsRoot, "*.csproj", SearchOption.AllDirectories)
                .Where(path => !path.Contains($"{Path.DirectorySeparatorChar}__tests__{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
                .Select(path => new
                {
                    RelativePath = Path.GetRelativePath(repoRoot, path),
                    Contents = File.ReadAllText(path)
                })
                .Where(project => project.Contents.Contains("*.cs", StringComparison.Ordinal))
                .Select(project => project.RelativePath)
                .OrderBy(path => path, StringComparer.Ordinal)
                .ToList();

            Assert.True(
                offenders.Count == 0,
                $"Contract project files should use explicit Compile includes for nccs compatibility. Offenders: {string.Join(", ", offenders)}");
        }

    }
}
