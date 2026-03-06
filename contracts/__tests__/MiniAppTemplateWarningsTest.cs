using Xunit;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class MiniAppTemplateWarningsTest
    {
        [Theory]
        [InlineData("Template.Governance.cs")]
        [InlineData("Template.Lottery.cs")]
        [InlineData("Template.Prediction.cs")]
        public void TemplatesDoNotUseObsoleteRuntimeScriptContainer(string fileName)
        {
            string code = ContractSourceAssertions.ReadSource(
                "contracts",
                "MiniAppTemplates",
                fileName);

            Assert.DoesNotContain("Runtime.ScriptContainer", code);
            Assert.Contains("Runtime.Transaction", code);
        }

        [Fact]
        public void MiniAppFactoryV2BuildHasNoNullableWarnings()
        {
            string repoRoot = ContractSourceAssertions.FindRepoRoot();
            string projectPath = Path.Combine(repoRoot, "contracts", "MiniAppFactoryV2", "MiniAppFactoryV2.csproj");

            var startInfo = new ProcessStartInfo("dotnet", $"build \"{projectPath}\" -v q -t:Rebuild")
            {
                WorkingDirectory = repoRoot,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false
            };

            using var process = Process.Start(startInfo);
            Assert.NotNull(process);

            string output = process!.StandardOutput.ReadToEnd() + Environment.NewLine + process.StandardError.ReadToEnd();
            process.WaitForExit();

            Assert.Equal(0, process.ExitCode);

            List<string> warnings = output
                .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(line => line.Contains("warning CS", StringComparison.Ordinal) &&
                               (line.Contains("contracts/MiniAppBase/", StringComparison.Ordinal) ||
                                line.Contains("contracts/MiniAppFactoryV2/", StringComparison.Ordinal)))
                .ToList();

            Assert.True(
                warnings.Count == 0,
                "Expected no MiniAppFactoryV2/MiniAppBase compiler warnings, but found:" + Environment.NewLine + string.Join(Environment.NewLine, warnings));
        }
    }
}
