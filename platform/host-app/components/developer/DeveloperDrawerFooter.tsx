"use client";

import { Button } from "@/components/ui/button";

type DeveloperDrawerFooterProps = {
  submitting: boolean;
  onCancel: () => void;
};

export function DeveloperDrawerFooter({ submitting, onCancel }: DeveloperDrawerFooterProps) {
  return (
    <div className="flex gap-3 pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        className="flex-1 border-gray-300 text-gray-600 transition-colors hover:bg-gray-100"
      >
        Cancel
      </Button>
      <Button
        type="submit"
        disabled={submitting}
        className="flex-1 bg-gradient-to-r from-neo to-emerald-600 font-semibold text-gray-900 hover:from-neo/90 hover:to-emerald-600/90"
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" />
            Saving...
          </span>
        ) : (
          "Save Draft"
        )}
      </Button>
    </div>
  );
}
