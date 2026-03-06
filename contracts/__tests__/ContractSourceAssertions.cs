using System;
using System.IO;
using System.Text.RegularExpressions;
using Xunit;

namespace NeoMiniAppPlatform.Contracts.Tests
{
    internal static class ContractSourceAssertions
    {
        public static string FindRepoRoot()
        {
            string[] startingPoints =
            {
                Directory.GetCurrentDirectory(),
                AppContext.BaseDirectory
            };

            foreach (string startingPoint in startingPoints)
            {
                string? root = TryFindRepoRoot(startingPoint);
                if (root != null)
                {
                    return root;
                }
            }

            throw new DirectoryNotFoundException("Could not locate repository root containing contracts/");
        }

        public static string ResolveRelativeSource(params string[] relativeSegments)
        {
            string path = FindRepoRoot();
            foreach (string segment in relativeSegments)
            {
                path = Path.Combine(path, segment);
            }

            if (!File.Exists(path))
            {
                throw new FileNotFoundException($"Expected source file was not found: {path}");
            }

            return path;
        }

        public static string ReadSource(params string[] relativeSegments)
        {
            return File.ReadAllText(ResolveRelativeSource(relativeSegments));
        }

        public static void AssertHasPublicClass(string code, string className)
        {
            AssertContainsDeclaration(
                code,
                $@"^\s*public\s+(?:partial\s+)?class\s+{Regex.Escape(className)}\b",
                $"Expected public class '{className}' was not found.");
        }

        public static void AssertHasPublicStruct(string code, string structName)
        {
            AssertContainsDeclaration(
                code,
                $@"^\s*public\s+struct\s+{Regex.Escape(structName)}\b",
                $"Expected public struct '{structName}' was not found.");
        }

        public static void AssertHasPublicStaticMethod(string code, string returnType, string methodName)
        {
            AssertContainsDeclaration(
                code,
                $@"^\s*public\s+static\s+{ToTypePattern(returnType)}\s+{Regex.Escape(methodName)}\s*\(",
                $"Expected public static method '{returnType} {methodName}(...)' was not found.");
        }

        public static void AssertHasPublicField(string code, string typeName, string fieldName)
        {
            AssertContainsDeclaration(
                code,
                $@"^\s*public\s+{ToTypePattern(typeName)}\s+{Regex.Escape(fieldName)}\s*;",
                $"Expected public field '{typeName} {fieldName};' was not found.");
        }

        private static void AssertContainsDeclaration(string code, string pattern, string message)
        {
            string strippedCode = StripComments(code);
            bool matched = Regex.IsMatch(strippedCode, pattern, RegexOptions.Multiline | RegexOptions.CultureInvariant);
            Assert.True(matched, message);
        }

        private static string? TryFindRepoRoot(string startingPoint)
        {
            string current = Path.GetFullPath(startingPoint);
            for (int i = 0; i < 16; i++)
            {
                if (Directory.Exists(Path.Combine(current, "contracts")))
                {
                    return current;
                }

                DirectoryInfo? parent = Directory.GetParent(current);
                if (parent == null)
                {
                    return null;
                }

                current = parent.FullName;
            }

            return null;
        }

        private static string StripComments(string code)
        {
            string withoutBlockComments = Regex.Replace(code, @"/\*.*?\*/", string.Empty, RegexOptions.Singleline);
            return Regex.Replace(withoutBlockComments, @"//.*$", string.Empty, RegexOptions.Multiline);
        }

        private static string ToTypePattern(string typeName)
        {
            return Regex.Escape(typeName).Replace(@"\ ", @"\s+");
        }
    }
}
