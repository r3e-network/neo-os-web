"use client";

import { type ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Dialog (root + trigger-less controlled usage)
// ---------------------------------------------------------------------------

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </RadixDialog.Root>
  );
}

// ---------------------------------------------------------------------------
// DialogContent
// ---------------------------------------------------------------------------

interface DialogContentProps {
  children: ReactNode;
  className?: string;
}

export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-erobo-bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-xl focus:outline-none",
          className,
        )}
      >
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

// ---------------------------------------------------------------------------
// DialogHeader / DialogFooter (layout wrappers, no Radix equivalent)
// ---------------------------------------------------------------------------

interface DialogSectionProps {
  children: ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogSectionProps) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

export function DialogFooter({ children, className }: DialogSectionProps) {
  return <div className={cn("mt-4 flex justify-end gap-2", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// DialogTitle
// ---------------------------------------------------------------------------

interface DialogTitleProps {
  children: ReactNode;
  className?: string;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  return (
    <RadixDialog.Title className={cn("text-lg font-semibold text-erobo-ink dark:text-white", className)}>
      {children}
    </RadixDialog.Title>
  );
}

// ---------------------------------------------------------------------------
// DialogDescription
// ---------------------------------------------------------------------------

interface DialogDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  return (
    <RadixDialog.Description className={cn("text-sm text-erobo-ink-soft dark:text-slate-300 mt-1", className)}>
      {children}
    </RadixDialog.Description>
  );
}
