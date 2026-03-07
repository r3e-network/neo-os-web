using Xunit;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    public class ContractBuildWarningsTest
    {
        [Fact]
        public void AppRegistryBuildHasNoNullableWarnings()
        {
            string repoRoot = ContractSourceAssertions.FindRepoRoot();
            string projectPath = Path.Combine(repoRoot, "contracts", "AppRegistry", "AppRegistry.csproj");

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
                               line.Contains("contracts/AppRegistry/", StringComparison.Ordinal))
                .ToList();

            Assert.True(
                warnings.Count == 0,
                "Expected no AppRegistry compiler warnings, but found:" + Environment.NewLine + string.Join(Environment.NewLine, warnings));
        }

        [Fact]
        public void PaymentHubBuildHasNoNullableWarnings()
        {
            string repoRoot = ContractSourceAssertions.FindRepoRoot();
            string projectPath = Path.Combine(repoRoot, "contracts", "PaymentHub", "PaymentHub.csproj");

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
                               line.Contains("contracts/PaymentHub/", StringComparison.Ordinal))
                .ToList();

            Assert.True(
                warnings.Count == 0,
                "Expected no PaymentHub compiler warnings, but found:" + Environment.NewLine + string.Join(Environment.NewLine, warnings));
        }

        [Fact]
        public void PriceFeedBuildHasNoNullableWarnings()
        {
            string repoRoot = ContractSourceAssertions.FindRepoRoot();
            string projectPath = Path.Combine(repoRoot, "contracts", "PriceFeed", "PriceFeed.csproj");

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
                               line.Contains("contracts/PriceFeed/", StringComparison.Ordinal))
                .ToList();

            Assert.True(
                warnings.Count == 0,
                "Expected no PriceFeed compiler warnings, but found:" + Environment.NewLine + string.Join(Environment.NewLine, warnings));
        }
    }
}
