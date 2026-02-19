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
    <div className="space-y-4">
      {/* ChatGPT Bot Link */}
      <div>
        <Link
          href="/bot"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 transition border",
            pathname === "/bot"
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "border-transparent hover:bg-muted/60"
          )}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">ChatGPT Bot</div>
            <div className="text-xs text-muted-foreground">Test E2EE solo</div>
          </div>
        </Link>
      </div>

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