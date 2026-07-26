import { Radio } from "lucide-react";

/**
 * The single loading state for every MiniApp and MiniGame bundle.
 *
 * Bundles are fetched from the CDN, so what the visitor waits on is identical
 * whichever surface they came through - the embedded workspace on a detail page
 * or the chrome-free /play route OneGate opens. Both render this, so an app
 * never appears to load differently depending on the entry point.
 */
export function MiniAppBundleLoader({
  name,
  iconUrl,
  version,
  variant = "embedded",
  testId,
}: {
  name: string;
  iconUrl?: string | null;
  version?: string | null;
  /** `standalone` fills the viewport and drops the surrounding card styling. */
  variant?: "embedded" | "standalone";
  testId?: string;
}) {
  const standalone = variant === "standalone";
  return (
    <div
      // The standalone variant is sized in viewport units, not by `inset-0`
      // alone: the host's page wrapper animates `transform`, which makes it the
      // containing block for fixed descendants and would otherwise collapse
      // this overlay to the wrapper's zero height.
      className={`grid place-items-center bg-[#faf9f7] px-6 text-center ${
        standalone ? "fixed inset-0 z-10 h-screen w-screen" : "absolute inset-0"
      }`}
      style={standalone ? { height: "100dvh" } : undefined}
      data-testid={testId}
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-sm">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            aria-hidden="true"
            className="mx-auto h-16 w-16 rounded-xl bg-white object-cover shadow-md shadow-gray-950/10 ring-1 ring-gray-200"
          />
        ) : (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-white shadow-md shadow-gray-950/10 ring-1 ring-gray-200">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gray-950 text-white shadow-inner">
              <Radio className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
        )}
        <p className="m-0 mt-5 text-base font-semibold text-gray-900">Loading {name}</p>
        {version ? (
          <p className="m-0 mt-1 text-xs text-gray-500">Version {version}</p>
        ) : null}
        {/* Three-bar pulse: an indeterminate cue, because a cross-origin iframe
            gives the host no download progress to report honestly. */}
        <div className="mx-auto mt-4 grid h-2 max-w-44 grid-cols-3 gap-1.5" aria-hidden="true">
          <span className="animate-pulse rounded-full bg-emerald-400 [animation-delay:0ms]" />
          <span className="animate-pulse rounded-full bg-sky-400 [animation-delay:150ms]" />
          <span className="animate-pulse rounded-full bg-orange-300 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
