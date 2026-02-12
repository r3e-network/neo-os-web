// =============================================================================
// MiniAppPreview — Sandboxed iframe preview for a MiniApp
// =============================================================================

"use client";

interface MiniAppPreviewProps {
  appId: string;
  previewUrl: string;
}

export function MiniAppPreview({ appId, previewUrl }: MiniAppPreviewProps) {
  if (!previewUrl) {
    return (
      <div className="text-muted-foreground text-sm">Preview unavailable (missing entry URL or non-iframe entry).</div>
    );
  }

  return (
    <div className="border-border/20 overflow-hidden rounded-lg border">
      <iframe
        title={`preview-${appId}`}
        src={previewUrl}
        className="h-[520px] w-full"
        sandbox="allow-scripts allow-forms allow-popups"
        referrerPolicy="no-referrer"
        allowFullScreen
      />
    </div>
  );
}
