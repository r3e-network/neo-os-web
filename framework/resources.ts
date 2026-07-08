/**
 * framework/resources — app.resources surface (extraction plan §2/S12).
 *
 * Standalone factory consumed by `createMiniAppFramework`. Resolves app asset
 * paths against the host base. Every host lane (onegate | miniapp-platform |
 * standalone) serves the miniapp bundle from its own directory and the apps
 * are built with Vite `base: "./"`, so the embedding document's base URI *is*
 * the host base; `baseUrl` exists as an explicit override and non-browser
 * environments degrade to app-relative `./` paths.
 *
 * Token artwork mirrors apps/shared/art/token-assets.ts: those URLs are
 * bundler-resolved (`?url` imports of the official Neo Press Kit art), so the
 * integration layer injects them via `deps.tokenArt` to keep the values
 * byte-identical to what scenes load today. When nothing is injected, the
 * surface falls back to resolving the canonical shared asset paths
 * (`assets/tokens/*.{svg,png}`) against the host base.
 */

import type { FrameworkHost } from "./index";

export interface FrameworkTokenArtUrls {
  /** Official GAS token artwork (SVG) for DOM renderers. */
  gasUrl: string;
  /**
   * Raster GAS artwork for Phaser preloaders — canvas rendering is more
   * reliable with PNG textures than class-styled SVG sources.
   */
  gasPhaserUrl: string;
  /** Official NEO token artwork (SVG) for DOM renderers. */
  neoUrl: string;
}

export interface ResourcesSurfaceDeps {
  /**
   * Host lane the miniapp runs in; mirrors `framework.platform.host`. Every
   * lane currently serves the bundle from its own directory (the document
   * base already encodes it), so this is accepted for wiring parity and
   * reserved for lanes whose resolution rules diverge.
   */
  host?: FrameworkHost | (() => FrameworkHost);
  /** Explicit base override (highest precedence); trailing slash optional. */
  baseUrl?: string;
  /**
   * Bundler-resolved token artwork URLs (apps/shared/art/token-assets).
   * Injected by the integration layer so values stay byte-identical.
   */
  tokenArt?: Partial<FrameworkTokenArtUrls>;
}

export interface FrameworkResourcesSurface {
  /**
   * Resolve an app-relative asset path against the host base. Already-absolute
   * URLs (scheme or protocol-relative) pass through untouched; leading `./`
   * and `/` are treated as app-base-relative, not origin-relative.
   */
  url(relPath: string): string;
  /** Resolve artwork the same way as {@link url} (readability alias for `<img>`/Phaser sources). */
  image(relPath: string): string;
  /** Official token artwork URLs (injected bundler values or base-resolved fallbacks). */
  tokenArt: FrameworkTokenArtUrls;
}

/** Canonical shared token-art paths, used only when no URLs are injected. */
const FALLBACK_TOKEN_ART_PATHS: FrameworkTokenArtUrls = {
  gasUrl: "assets/tokens/gas-icon.svg",
  gasPhaserUrl: "assets/tokens/gas-icon.png",
  neoUrl: "assets/tokens/neo-icon.svg",
};

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//");
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export function createResourcesSurface(deps: ResourcesSurfaceDeps = {}): FrameworkResourcesSurface {
  const resolve = (relPath: string): string => {
    const raw = String(relPath ?? "").trim();
    if (!raw) return "";
    if (isAbsoluteUrl(raw)) return raw;

    const clean = raw.replace(/^(?:\.\/|\/)+/, "");
    const explicit = deps.baseUrl?.trim();
    if (explicit) {
      if (isAbsoluteUrl(explicit)) {
        return new URL(clean, withTrailingSlash(explicit)).toString();
      }
      return `${withTrailingSlash(explicit)}${clean}`;
    }

    const documentBase = typeof document !== "undefined" ? document.baseURI : "";
    if (documentBase) {
      return new URL(clean, documentBase).toString();
    }

    // No document (SSR/tests) — degrade to app-relative paths in every lane.
    return `./${clean}`;
  };

  return {
    url: resolve,
    image: resolve,
    get tokenArt(): FrameworkTokenArtUrls {
      return {
        gasUrl: deps.tokenArt?.gasUrl ?? resolve(FALLBACK_TOKEN_ART_PATHS.gasUrl),
        gasPhaserUrl: deps.tokenArt?.gasPhaserUrl ?? resolve(FALLBACK_TOKEN_ART_PATHS.gasPhaserUrl),
        neoUrl: deps.tokenArt?.neoUrl ?? resolve(FALLBACK_TOKEN_ART_PATHS.neoUrl),
      };
    },
  };
}
