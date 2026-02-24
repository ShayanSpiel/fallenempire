"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, X, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GameLog = {
  id: string;
  created_at: string;
  source: string;
  message: string;
  level: "info" | "warn" | "error" | "success";
};

export function GameTerminal() {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_GAME_TERMINAL === "true";

  if (!enabled) {
    return null;
  }

  const [logs, setLogs] = useState<GameLog[]>([]);
  const [open, setOpen] = useState(false);
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(
    null
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const supabase = supabaseRef.current ?? createSupabaseBrowserClient();
    supabaseRef.current = supabase;

    const fetchLogs = async () => {
      const { data } = await supabase
        .from("game_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);

      if (data) {
        setLogs(data.reverse());
      }
    };

    fetchLogs();

    const channel = supabase
      .channel("game_logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_logs" },
        (payload: any) => {
          setLogs((prev) => [...prev, payload.new as GameLog]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, open]);

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-border bg-background/80 backdrop-blur"
        size="icon"
      >
        <Terminal className="size-5" />
      </Button>
    );
  }

  const colorClass = (level: string) => {
    switch (level) {
      case "error":
        return "text-destructive";
      case "warn":
        return "text-warning";
      case "success":
        return "text-success";
      default:
        return "text-primary";
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[90vw] max-w-lg overflow-hidden rounded-lg border border-border/40 bg-card text-xs text-foreground shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 p-3 text-xs font-semibold uppercase tracking-wider">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Terminal className="size-4" />
          SYS.LOG
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setLogs([])}>
            <X className="size-3" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
            <Minimize2 className="size-3" />
          </Button>
        </div>
      </div>
      <ScrollArea className="h-64 bg-muted/20 p-3">
        <div className="flex flex-col gap-2 font-mono text-[11px]">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 text-foreground/80">
              <span className="text-muted-foreground/60">
                [{new Date(log.created_at).toLocaleTimeString()}]
              </span>
              <span className={cn("font-semibold", colorClass(log.level))}>{log.source}</span>
              <span className="text-white/80">{log.message}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
