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
    <div className="group relative my-6 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100/80 px-4 py-2.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code"
          className="cursor-pointer flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-mono font-semibold text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-black/5 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 focus-visible:opacity-100"
        >
          {copied ? <><Check size={12} className="text-neo" /><span className="text-neo">Copied</span></> : <><Copy size={12} /><span>Copy</span></>}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 text-[13px] leading-[1.65]">
        <code className="font-mono tracking-wide text-gray-700">{code}</code>
      </pre>
    </div>
  );
}
