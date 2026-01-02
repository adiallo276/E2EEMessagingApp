"use client";

import { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function AppShell({
  sidebar,
  header,
  children,
}: {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="h-screen w-screen bg-background text-foreground">
      <div className="grid h-full grid-cols-[280px_1fr]">
        <aside className="border-r bg-muted/20">
          <div className="h-14 px-4 flex items-center font-semibold">
            Q-Messaging
          </div>
          <Separator />
          <ScrollArea className="h-[calc(100vh-3.5rem)]">
            <div className="p-3">{sidebar}</div>
          </ScrollArea>
        </aside>

        <main className="flex h-full flex-col">
          <div className="h-14 border-b bg-muted/10 flex items-center px-4">
            {header}
          </div>
          <div className="flex-1 overflow-hidden">{children}</div>
        </main>
      </div>
    </div>
  );
}