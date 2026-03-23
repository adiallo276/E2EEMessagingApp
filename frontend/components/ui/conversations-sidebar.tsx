"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ConversationItem = {
  id: number | string;
  title: string;
  lastMessage?: string;
  unread?: number;
};

export default function ConversationsSidebar({
  items,
}: {
  items: ConversationItem[];
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Header - matches main chat header height */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        <h2 className="text-sm font-semibold">Direct Messages</h2>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            No conversations yet
          </div>
        ) : (
          items.map((c) => {
            const active = pathname?.includes(`/messages/${c.id}`);
            return (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 transition",
                  active ? "bg-muted" : "hover:bg-muted/50"
                )}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs font-medium">
                    {c.title.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.title}</span>
                    {c.unread ? (
                      <Badge className="h-5 px-1.5 text-[10px] font-medium">{c.unread}</Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    {c.lastMessage ?? "No messages yet"}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}