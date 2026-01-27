"use client";

import ThemeToggle from "@/components/ui/theme-toggle";

export default function AppShell({
  header,
  sidebar,
  children,
}: {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      {sidebar && (
        <aside className="w-64 border-r border-border bg-sidebar">
          {sidebar}
        </aside>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="h-14 border-b border-border bg-background px-4 flex items-center justify-between">
          {/* Left: page-specific header content */}
          <div className="flex items-center gap-2">
            {header}
          </div>

          {/* Right: GLOBAL CONTROLS */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}