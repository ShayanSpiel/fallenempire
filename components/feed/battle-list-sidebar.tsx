"use client";

import Link from "next/link";
import { Swords, ArrowRight } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { resolveAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type BattleListItem = {
  id: string;
  attacker: { name: string; slug?: string } | null;
  defender: { name: string; slug?: string } | null;
  status: string;
};

type BattleListSidebarProps = {
  battles: BattleListItem[];
};

export function BattleListSidebar({ battles }: BattleListSidebarProps) {
  const recentBattles = battles.slice(0, 5);

  return (
    <aside className="rounded-3xl border border-border/60 bg-card/90 p-6 backdrop-blur">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/60">
        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
          <Swords size={14} />
          Active Battles
        </h3>
      </div>

      <div className="space-y-3">
        {recentBattles.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No active battles
          </p>
        ) : (
          recentBattles.map((battle) => (
            <Link
              key={battle.id}
              href={`/battle/${battle.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "block rounded-xl border border-border/50 bg-card/50 p-3",
                "hover:border-border hover:bg-card/80 transition-all duration-200",
                "group"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                {/* Attacker */}
                <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                  <Avatar className="h-8 w-8 rounded-lg border border-destructive/40">
                    <AvatarImage
                      src={resolveAvatar({ seed: battle.attacker?.name ?? "Atk" })}
                    />
                    <AvatarFallback className="text-destructive bg-destructive/10 text-[10px] font-bold">
                      ATK
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className="text-[10px] font-bold text-center truncate w-full"
                    title={battle.attacker?.name}
                  >
                    {battle.attacker?.name || "Unknown"}
                  </span>
                </div>

                {/* VS Icon */}
                <div className="flex items-center justify-center shrink-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-muted-foreground opacity-60"
                  >
                    <path
                      d="M8 3L3 8L8 13M16 11L21 16L16 21"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Defender */}
                <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                  <Avatar className="h-8 w-8 rounded-lg border border-secondary/40">
                    <AvatarImage
                      src={resolveAvatar({ seed: battle.defender?.name ?? "Def" })}
                    />
                    <AvatarFallback className="text-secondary bg-secondary/10 text-[10px] font-bold">
                      DEF
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className="text-[10px] font-bold text-center truncate w-full"
                    title={battle.defender?.name}
                  >
                    {battle.defender?.name || "Neutral"}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border/60">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs font-semibold"
        >
          <Link href="/battle">
            All Battles
            <ArrowRight size={12} />
          </Link>
        </Button>
      </div>
    </aside>
  );
}
