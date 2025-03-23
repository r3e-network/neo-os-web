'use client';

import EnhancedDocsLayout from './enhanced-layout';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EnhancedDocsLayout>
      {children}
    </EnhancedDocsLayout>
  );
}