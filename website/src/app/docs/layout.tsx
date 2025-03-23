"use client";

import DocsSidebar from '@/components/docs/DocsSidebar';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <div className="md:w-64 md:fixed md:h-[calc(100vh-64px)] top-16 shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
        <DocsSidebar />
      </div>
      <div className="flex-1 md:ml-64">
        <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
          {children}
        </div>
      </div>
    </div>
  );
}