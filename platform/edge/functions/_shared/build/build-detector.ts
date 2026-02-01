// Build Detector for MiniApp submissions
// Detects build type and configuration from project files

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { existsSync } from "https://deno.land/std@0.224.0/fs/mod.ts";

export type BuildType = "vite" | "webpack" | "uniapp" | "vanilla" | "nextjs" | "unknown";

export interface BuildConfig {
  type: BuildType;
  buildCommand: string;
  outputDir: string;
  configFiles: string[];
  packageManager: "npm" | "pnpm" | "yarn";
  env?: Record<string, string>;
}

/**
 * Detect build type from project structure
 * @param projectDir - Path to project directory
 * @returns Detected build configuration
 */
export async function detectBuildConfig(projectDir: string): Promise<BuildConfig> {
  // Check for config files
  const configFiles = await scanConfigFiles(projectDir);

  // Detect build type
  const buildType = detectBuildTypeFromConfig(configFiles);

  // Get package manager
  const packageManager = await detectPackageManager(projectDir);

  // Determine build command and output dir
  const config = getBuildConfig(buildType, packageManager, configFiles);

  return {
    ...config,
    configFiles,
    packageManager,
  };
}

/**
 * Scan for build configuration files
 * @param projectDir - Path to project directory
 * @returns Array of found config files
 */
async function scanConfigFiles(projectDir: string): Promise<string[]> {
  const configFiles: string[] = [];

  const configPatterns = [
    "vite.config.ts",
    "vite.config.js",
    "webpack.config.js",
    "webpack.config.ts",
    "next.config.js",
    "vue.config.js",
    "uniapp.config.js",
    "tsconfig.json",
    "package.json",
    "nuxt.config.ts",
  ];

  for (const pattern of configPatterns) {
    const fullPath = join(projectDir, pattern);
    try {
      const stat = await Deno.stat(fullPath);
      if (stat.isFile) {
        configFiles.push(pattern);
      }
    } catch {
      // File doesn't exist
    }
  }

  return configFiles;
}

/**
 * Detect build type from configuration files
 * @param configFiles - Array of config file names
 * @returns Detected build type
 */
function detectBuildTypeFromConfig(configFiles: string[]): BuildType {
  const configFileSet = new Set(configFiles);

  // Check for Next.js
  if (configFileSet.has("next.config.js") || configFileSet.has("next.config.mjs")) {
    return "nextjs";
  }

  // Check for Vite
  if (configFileSet.has("vite.config.ts") || configFileSet.has("vite.config.js")) {
    return "vite";
  }

  // Check for uni-app
  if (configFileSet.has("uniapp.config.js") || configFileSet.has("manifest.json") || configFileSet.has("pages.json")) {
    return "uniapp";
  }

  // Check for Webpack
  if (configFileSet.has("webpack.config.js") || configFileSet.has("webpack.config.ts")) {
    return "webpack";
  }

  // Check if it's a vanilla HTML/CSS/JS project
  if (configFileSet.has("index.html")) {
    return "vanilla";
  }

  return "unknown";
}

/**
 * Detect package manager
 * @param projectDir - Path to project directory
 * @returns Detected package manager
 */
async function detectPackageManager(projectDir: string): Promise<"npm" | "pnpm" | "yarn"> {
  // Check for lock files
  const lockFiles = ["pnpm-lock.yaml", "yarn.lock", "package-lock.json"];

  for (const lockFile of lockFiles) {
    const fullPath = join(projectDir, lockFile);
    try {
      const stat = await Deno.stat(fullPath);
      if (stat.isFile) {
        if (lockFile === "pnpm-lock.yaml") return "pnpm";
        if (lockFile === "yarn.lock") return "yarn";
        if (lockFile === "package-lock.json") return "npm";
      }
    } catch {
      // File doesn't exist
    }
  }

  // Default to npm
  return "npm";
}

/**
 * Get build command and output directory for build type
 * @param buildType - Detected build type
 * @param packageManager - Detected package manager
 * @param configFiles - Found config files
 * @returns Build configuration
 */
function getBuildConfig(
  buildType: BuildType,
  packageManager: "npm" | "pnpm" | "yarn",
  configFiles: string[]
): Omit<BuildConfig, "configFiles" | "packageManager"> {
  const pmCmd = packageManager === "yarn" ? "yarn" : packageManager;

  const configs: Record<BuildType, Omit<BuildConfig, "configFiles" | "packageManager">> = {
    vite: {
      type: "vite",
      buildCommand: `${pmCmd} run build`,
      outputDir: "dist",
    },
    webpack: {
      type: "webpack",
      buildCommand: `${pmCmd} run build`,
      outputDir: "dist",
    },
    uniapp: {
      type: "uniapp",
      buildCommand: `${pmCmd} run build:h5`,
      outputDir: "dist/build/h5",
    },
    nextjs: {
      type: "nextjs",
      buildCommand: `${pmCmd} run build`,
      outputDir: ".next",
    },
    vanilla: {
      type: "vanilla",
      buildCommand: "",
      outputDir: ".",
    },
    unknown: {
      type: "unknown",
      buildCommand: `${pmCmd} run build`,
      outputDir: "dist",
    },
  };

  return configs[buildType] || configs.unknown;
}

/**
 * Read build configuration from package.json scripts
 * @param projectDir - Path to project directory
 * @returns Available scripts
 */
export async function readPackageScripts(projectDir: string): Promise<Record<string, string>> {
  const packageJsonPath = join(projectDir, "package.json");

  try {
    const content = await Deno.readTextFile(packageJsonPath);
    const pkg = JSON.parse(content);

    return pkg.scripts || {};
  } catch {
    return {};
  }
}

/**
 * Validate that project can be built
 * @param projectDir - Path to project directory
 * @returns Validation result
 */
export async function validateBuildSetup(
  projectDir: string
): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for package.json
  const packageJsonPath = join(projectDir, "package.json");
  try {
    await Deno.stat(packageJsonPath);
  } catch {
    errors.push("package.json not found");
  }

  // Check for node_modules
  const nodeModulesPath = join(projectDir, "node_modules");
  try {
    await Deno.stat(nodeModulesPath);
  } catch {
    warnings.push("node_modules not found - dependencies may need to be installed");
  }

  // Detect build configuration
  const buildConfig = await detectBuildConfig(projectDir);
  if (buildConfig.type === "unknown") {
    warnings.push("Could not detect build type - may need manual configuration");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
