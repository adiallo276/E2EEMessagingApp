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
    <div className="space-y-2">
      <div className="px-2 text-xs font-semibold text-muted-foreground">
        DIRECT MESSAGES
      </div>

      <div className="space-y-1">
        {items.map((c) => {
          const active = pathname?.includes(`/messages/${c.id}`);
          return (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition",
                active ? "bg-muted" : "hover:bg-muted/60"
              )}
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs">
                  {c.title.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-medium">{c.title}</div>
                  {c.unread ? (
                    <Badge className="h-5 px-2 text-xs">{c.unread}</Badge>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.lastMessage ?? "No messages yet"}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}