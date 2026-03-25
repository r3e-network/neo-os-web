using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class MiniAppDevPackBuildWarningsTest
    {
        [Fact]
        public void LastSurvivorBuildHasNoDevPackCompilerWarnings()
        {
            string repoRoot = ContractSourceAssertions.FindRepoRoot();
            string projectPath = Path.Combine(repoRoot, "contracts", "MiniAppLastSurvivor", "MiniAppLastSurvivor.csproj");

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

            List<string> devPackWarnings = output
                .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(line => line.Contains("warning CS", StringComparison.Ordinal) &&
                               line.Contains("contracts/MiniApp.DevPack/", StringComparison.Ordinal))
                .ToList();

            Assert.True(
                devPackWarnings.Count == 0,
                "Expected no MiniApp.DevPack compiler warnings, but found:" + Environment.NewLine + string.Join(Environment.NewLine, devPackWarnings));
        }
    }
}
