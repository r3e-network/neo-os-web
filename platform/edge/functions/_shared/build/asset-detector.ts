// Asset Detector for MiniApp submissions
// Scans project directories for manifest files and assets

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

export interface DetectedAssets {
  icon?: string[];
  banner?: string[];
  screenshot?: string[];
  manifest?: string;
}

export interface AssetMetadata {
  width: number;
  height: number;
  size: number;
  type: string;
}

type AssetListKey = "icon" | "banner" | "screenshot";

// Default asset search patterns
const ASSET_PATTERNS: Record<AssetListKey, string[]> = {
  icon: [
    "icon.png",
    "logo.jpg",
    "app-icon.png",
    "static/icon.png",
    "static/logo.jpg",
    "assets/logo.jpg",
    "assets/icon.png",
    "public/icon.png",
    "public/logo.jpg",
    "src/assets/icon.png",
  ],
  banner: ["banner.jpg", "app-banner.jpg", "static/banner.jpg", "assets/banner.jpg", "public/banner.jpg"],
  screenshot: ["screenshot.png", "preview.png", "assets/screenshot.png", "docs/screenshot.png"],
};

// Manifest file patterns
const MANIFEST_PATTERNS = [
  "manifest.json",
  "neo-manifest.json",
  "package.json", // Fallback for package-based apps
];

/**
 * Detect assets in a project directory
 * @param projectDir - Path to project directory
 * @param customPatterns - Optional custom asset patterns
 * @returns Detected assets
 */
export async function detectAssets(
  projectDir: string,
  customPatterns?: Partial<Record<AssetListKey, string[]>>
): Promise<DetectedAssets> {
  const patterns = { ...ASSET_PATTERNS, ...customPatterns };
  const result: DetectedAssets = {};

  for (const [assetType, filePatterns] of Object.entries(patterns) as [AssetListKey, string[]][]) {
    const found: string[] = [];

    for (const pattern of filePatterns) {
      const fullPath = join(projectDir, pattern);
      try {
        const stat = await Deno.stat(fullPath);
        if (stat.isFile) {
          found.push(pattern);
        }
      } catch {
        // File doesn't exist, continue
      }
    }

    if (found.length > 0) {
      result[assetType] = found;
    }
  }

  // Detect manifest file
  for (const manifestFile of MANIFEST_PATTERNS) {
    try {
      const manifestPath = join(projectDir, manifestFile);
      const stat = await Deno.stat(manifestPath);
      if (stat.isFile) {
        result.manifest = manifestFile;
        break;
      }
    } catch {
      // Continue to next pattern
    }
  }

  return result;
}

/**
 * Extract metadata from an asset file
 * @param filePath - Path to asset file
 * @returns Asset metadata
 */
export async function extractAssetMetadata(filePath: string): Promise<AssetMetadata> {
  try {
    const stat = await Deno.stat(filePath);
    const ext = filePath.split(".").pop();

    // Basic metadata
    const metadata: AssetMetadata = {
      width: 0,
      height: 0,
      size: stat.size,
      type: ext || "unknown",
    };

    // For images, we could use image processing to get dimensions
    // For now, return basic info
    return metadata;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract metadata from ${filePath}: ${message}`);
  }
}

/**
 * Read and parse manifest file
 * @param projectDir - Path to project directory
 * @returns Parsed manifest object
 */
export async function readManifest(projectDir: string): Promise<object> {
  // First, find the manifest file
  const assets = await detectAssets(projectDir);

  if (!assets.manifest) {
    throw new Error("No manifest file found");
  }

  const manifestPath = join(projectDir, assets.manifest);

  try {
    const content = await Deno.readTextFile(manifestPath);
    return JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read manifest: ${message}`);
  }
}

/**
 * Validate manifest structure
 * @param manifest - Manifest object to validate
 * @returns Validation result
 */
export function validateManifest(manifest: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== "object") {
    return { valid: false, errors: ["Manifest must be an object"] };
  }

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (!m.app_id || typeof m.app_id !== "string") {
    errors.push("app_id is required and must be a string");
  }

  if (!m.name || typeof m.name !== "string") {
    errors.push("name is required and must be a string");
  }

  if (!m.description || typeof m.description !== "string") {
    errors.push("description is required and must be a string");
  }

  if (!m.category || typeof m.category !== "string") {
    errors.push("category is required and must be a string");
  }

  if (!m.entry_url || typeof m.entry_url !== "string") {
    errors.push("entry_url is required and must be a string");
  }

  // Arrays
  if (!m.supported_chains || !Array.isArray(m.supported_chains)) {
    errors.push("supported_chains is required and must be an array");
  }

  // Permissions
  if (m.permissions && typeof m.permissions !== "object") {
    errors.push("permissions must be an object");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detect if project has pre-built files (should reject)
 * @param projectDir - Path to project directory
 * @returns True if pre-built files detected
 */
export async function hasPrebuiltFiles(projectDir: string): Promise<{
  hasPrebuilt: boolean;
  detectedFiles: string[];
}> {
  const prebuiltIndicators = ["dist/", "build/", ".next/", "out/", "bundle.js", "bundle.css"];

  const detectedFiles: string[] = [];

  for (const indicator of prebuiltIndicators) {
    const fullPath = join(projectDir, indicator);

    try {
      const stat = await Deno.stat(fullPath);
      if (stat.isDirectory || stat.isFile) {
        detectedFiles.push(indicator);
      }
    } catch {
      // Doesn't exist, continue
    }
  }

  return {
    hasPrebuilt: detectedFiles.length > 0,
    detectedFiles,
  };
}
