"use client";

import { useState, useEffect, useRef } from "react";
import { Check, Copy } from "lucide-react";

type CodeBlockProps = {
  code: string;
  language?: string;
};

export function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    navigator.clipboard.writeText(code).catch((e: unknown) => { console.warn("[CodeBlock] clipboard write failed:", e instanceof Error ? e.message : String(e)); });
    setCopied(true);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-6 overflow-hidden rounded-3xl border border-gray-800 bg-gray-900/90 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#0A0B10]/80">
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-800/50 px-4 py-3 text-gray-300 dark:border-white/5 dark:bg-white/5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code"
          className="cursor-pointer rounded-lg border border-white/5 bg-white/5 p-2 shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
        >
          {copied ? <Check size={14} className="text-neo" /> : <Copy size={14} className="text-gray-300" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 text-sm">
        <code className="font-mono leading-relaxed tracking-wide text-[#a5d6ff]">{code}</code>
      </pre>
    </div>
  );
}
