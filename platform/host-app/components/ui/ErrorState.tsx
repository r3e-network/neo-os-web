import React from "react";
import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, Home, ArrowLeft } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onBack?: () => void;
  onHome?: () => void;
  className?: string;
  variant?: "default" | "minimal" | "fullpage";
}

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
  onBack,
  onHome,
  className,
  variant = "default",
}: ErrorStateProps) {
  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20", className)}>
        <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-500">{title}</p>
          {message && <p className="text-xs text-red-400/80 mt-0.5 truncate">{message}</p>}
        </div>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="text-red-500 hover:bg-red-500/10">
            <RefreshCw size={14} />
          </Button>
        )}
      </div>
    );
  }

  if (variant === "fullpage") {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-8", className)}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle size={40} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-erobo-ink dark:text-white mb-2">{title}</h1>
          <p className="text-erobo-ink-soft/70 dark:text-slate-400 mb-8">{message}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {onRetry && (
              <Button onClick={onRetry} className="erobo-btn">
                <RefreshCw size={16} className="mr-2" />
                Try Again
              </Button>
            )}
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft size={16} className="mr-2" />
                Go Back
              </Button>
            )}
            {onHome && (
              <Button variant="ghost" onClick={onHome}>
                <Home size={16} className="mr-2" />
                Home
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // Default variant
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center", className)}
    >
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertCircle size={32} className="text-red-500" />
      </div>
      <h3 className="text-lg font-bold text-erobo-ink dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-erobo-ink-soft/70 dark:text-slate-400 mb-6 max-w-sm mx-auto">{message}</p>
      <div className="flex gap-3 justify-center">
        {onRetry && (
          <Button onClick={onRetry} size="sm" className="erobo-btn">
            <RefreshCw size={14} className="mr-2" />
            Retry
          </Button>
        )}
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft size={14} className="mr-2" />
            Back
          </Button>
        )}
      </div>
    </motion.div>
  );
}
