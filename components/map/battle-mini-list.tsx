"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ActiveBattleRow, RegionOwnersMap } from "@/components/map/region-types";
import { resolveAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { MapPin, Swords } from "lucide-react";
import { WallMeter } from "@/components/ui/wall-meter";

type BattleMiniListProps = {
  battles: ActiveBattleRow[];
  regionOwners: RegionOwnersMap;
  compact?: boolean;
};

function BattleTimer({
  endsAt,
  className,
}: {
  endsAt?: string | null;
  className?: string;
}) {
  const [timeLeft, setTimeLeft] = useState("--:--:--");

  useEffect(() => {
    if (!endsAt) {
      setTimeLeft("--:--:--");
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const target = new Date(endsAt).getTime();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft("00:00:00");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(
        `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [endsAt]);

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.35em] text-muted-foreground/80",
        className
      )}
    >
      <span>{timeLeft}</span>
    </div>
  );
}

function BattleMiniCard({
  battle,
  regionName,
  compact,
}: {
  battle: ActiveBattleRow;
  regionName: string;
  compact?: boolean;
}) {
  const attackerName = battle.attacker?.name ?? "Attacker";
  const defenderName = battle.defender?.name ?? "Defender";
  const attackerSeed = battle.attacker?.name ?? battle.attacker_community_id;
  const defenderSeed = battle.defender?.name ?? battle.defender_community_id ?? "Neutral";
  const attackerColor = battle.attacker?.color;
  const defenderColor = battle.defender?.color;
  const widthClass = compact ? "min-w-[10rem] max-w-[10rem]" : "min-w-[12.5rem] max-w-[12.5rem]";

  return (
    <a
      href={`/battle/${battle.id}`}
      target="_blank"
      rel="noreferrer"
      className={cn("group flex-shrink-0", widthClass)}
    >
      <Card className="rounded-xl h-full border border-border/60 bg-card/95 p-3 shadow-sm transition-all duration-150 hover:border-destructive/80 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex w-full items-center justify-center gap-1 text-[10px] font-bold text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-destructive" />
            <span className="truncate">{regionName}</span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-1">
          <div className="flex flex-col items-center gap-1 w-[5.2rem]">
            <Avatar
              className="h-9 w-9 rounded-lg border border-border/40 shadow"
              style={attackerColor ? { borderColor: attackerColor } : undefined}
            >
              <AvatarImage src={resolveAvatar({ seed: attackerSeed })} />
              <AvatarFallback className="text-destructive font-bold bg-destructive/10">
                ATK
              </AvatarFallback>
            </Avatar>
            <span className="text-[9px] font-semibold text-muted-foreground truncate w-full text-center">
              {attackerName}
            </span>
          </div>

          <div className="flex flex-col items-center gap-0 text-[10px] font-semibold uppercase tracking-[0.35em] text-muted-foreground px-1">
            <span>VS</span>
          </div>

          <div className="flex flex-col items-center gap-1 w-[5.2rem]">
            <Avatar
              className="h-9 w-9 rounded-lg border border-border/40 shadow"
              style={defenderColor ? { borderColor: defenderColor } : undefined}
            >
              <AvatarImage src={resolveAvatar({ seed: defenderSeed })} />
              <AvatarFallback className="text-secondary font-bold bg-secondary/10">
                DEF
              </AvatarFallback>
            </Avatar>
            <span className="text-[9px] font-semibold text-muted-foreground truncate w-full text-center">
              {defenderName}
            </span>
          </div>
        </div>

        <div className="mt-2">
          <WallMeter
            value={(battle.initial_defense ?? 0) - (battle.current_defense ?? 0)}
          />
        </div>

        <BattleTimer
          endsAt={battle.ends_at}
          className="mt-2 w-full justify-center bg-background/60 px-3 py-1 rounded-full text-center"
        />
      </Card>
    </a>
  );
}

export function BattleMiniList({ battles, regionOwners, compact = false }: BattleMiniListProps) {
  const activeBattles = useMemo(() => {
    return battles
      .filter((battle) => battle.status === "active")
      .sort((a, b) => {
        const aTime = a.ends_at ? new Date(a.ends_at).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.ends_at ? new Date(b.ends_at).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });
  }, [battles]);

  const availableWidthRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [compactVisibleCount, setCompactVisibleCount] = useState<number | null>(null);
  const [compactViewportWidthPx, setCompactViewportWidthPx] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);

  useEffect(() => {
    if (!compact) {
      setCompactVisibleCount(null);
      setCompactViewportWidthPx(null);
      return;
    }

    const availableEl = availableWidthRef.current;
    const listEl = listRef.current;
    if (!availableEl || !listEl) return;

    const update = () => {
      const computed = window.getComputedStyle(listEl);
      const gapPx =
        Number.parseFloat(computed.columnGap || computed.gap || "0") || 0;
      const paddingLeftPx = Number.parseFloat(computed.paddingLeft || "0") || 0;
      const paddingRightPx = Number.parseFloat(computed.paddingRight || "0") || 0;

      const firstChild = listEl.firstElementChild as HTMLElement | null;
      const fallbackCardWidthPx = 10 * 16; // min-w-[10rem]
      const cardWidthPx =
        firstChild?.getBoundingClientRect().width || fallbackCardWidthPx;

      const available = Math.max(0, availableEl.clientWidth);
      if (available <= 0) {
        setCompactVisibleCount(0);
        setCompactViewportWidthPx(0);
        return;
      }

      const innerAvailable = Math.max(0, available - paddingLeftPx - paddingRightPx);
      const rawCount = Math.floor((innerAvailable + gapPx) / (cardWidthPx + gapPx));
      const count = Math.max(1, rawCount);
      setCompactVisibleCount(count);

      const viewportWidth =
        paddingLeftPx +
        paddingRightPx +
        count * cardWidthPx +
        (count - 1) * gapPx;
      setCompactViewportWidthPx(Math.min(available, viewportWidth));
    };

    requestAnimationFrame(update);
    const ro = new ResizeObserver(() => update());
    ro.observe(availableEl);
    return () => ro.disconnect();
  }, [compact]);

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    const el = listRef.current;
    if (!el) return;
    if (!el.scrollWidth || el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    e.stopPropagation();
    el.scrollLeft += e.deltaY;
  };

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const el = listRef.current;
    if (!el) return;
    if (!el.scrollWidth || el.scrollWidth <= el.clientWidth) return;
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = el.scrollLeft;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!isDraggingRef.current) return;
    const el = listRef.current;
    if (!el) return;
    const dx = e.clientX - dragStartXRef.current;
    el.scrollLeft = dragStartScrollLeftRef.current - dx;
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  if (!activeBattles.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 max-h-[calc(100vh-8rem)] overflow-hidden">
      <div className="flex justify-end">
        <div className="flex items-center gap-2 rounded-full border border-border/40 bg-background/70 px-3 py-1 text-sm font-bold text-foreground/80 shadow-sm backdrop-blur-lg">
          <Swords className="h-4 w-4 text-destructive" />
          <span>Active Battles ({activeBattles.length})</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pr-1">
        <div ref={availableWidthRef} className="mt-2 flex w-full justify-end">
          <div
            ref={listRef}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={
              compact && compactViewportWidthPx
                ? { width: `${compactViewportWidthPx}px` }
                : undefined
            }
            className={cn(
              "flex items-stretch justify-end gap-3 overflow-x-auto pb-1 pr-1 pl-1 scrollbar-thin scrollbar-thumb-border/60 scrollbar-track-transparent cursor-grab active:cursor-grabbing touch-pan-x overscroll-x-contain",
              compact ? "w-fit max-w-full" : "w-full"
            )}
          >
            {activeBattles.map((battle) => {
              const region = regionOwners[battle.target_hex_id];
              // Use display_name as SINGLE SOURCE OF TRUTH
              const regionLabel =
                region?.display_name ||
                region?.custom_name?.trim() ||
                region?.province_name?.trim() ||
                `#${battle.target_hex_id}`;
              return (
                <BattleMiniCard
                  key={battle.id}
                  battle={battle}
                  regionName={regionLabel}
                  compact={compact}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
