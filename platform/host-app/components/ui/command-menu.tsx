"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Command } from "cmdk";
import { Search, LayoutGrid, FileText, Code2 } from "lucide-react";

const commands = [
  { id: "home", label: "Home", icon: LayoutGrid, href: "/" },
  { id: "miniapps", label: "MiniApps", icon: LayoutGrid, href: "/miniapps" },
  { id: "docs", label: "Documentation", icon: FileText, href: "/docs" },
  { id: "developer", label: "Developer", icon: Code2, href: "/developer" },
];

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm cursor-pointer" role="dialog" aria-modal="true" aria-label="Command menu" onClick={() => setOpen(false)}>
      <div className="fixed left-1/2 top-1/4 -translate-x-1/2 w-full max-w-lg cursor-default" onClick={(e) => e.stopPropagation()}>
        <Command className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-900 shadow-2xl">
          <div className="flex items-center border-b border-gray-200 dark:border-white/10 px-3">
            <Search className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <Command.Input
              placeholder="Search..."
              className="h-12 w-full bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No results found.</Command.Empty>
            {commands.map((cmd) => (
              <Command.Item
                key={cmd.id}
                onSelect={() => runCommand(cmd.href)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                <cmd.icon size={16} />
                {cmd.label}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
