"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatar } from "@/lib/avatar";

export interface BaseToastProps {
  username: string;
  avatarUrl?: string | null;
  isAttacker: boolean;
  toastBg: string;
  toastShadow: string;
  toastText: string;
  children: React.ReactNode; // Content area (damage/result)
}

export function BaseToast({
  username,
  avatarUrl,
  isAttacker,
  toastBg,
  toastShadow,
  toastText,
  children,
}: BaseToastProps) {
  const getUserAvatar = (name: string, url?: string | null) =>
    resolveAvatar({ avatarUrl: url, seed: name });

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent",
        isAttacker && "flex-row-reverse", // Reverse layout for attackers
        toastBg,
        toastShadow,
        "animate-in",
        isAttacker ? "slide-in-from-right-4" : "slide-in-from-left-4",
        "toast-fade-inout"
      )}
    >
      {/* Avatar */}
      <Avatar className="h-12 w-12 border border-border/60 flex-shrink-0">
        <AvatarImage src={getUserAvatar(username, avatarUrl)} />
        <AvatarFallback>{username.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>

      {/* Username and Label */}
      <div className={cn("flex-1 min-w-0", isAttacker && "text-right")}>
        {/* Side Label */}
        <div className={cn("text-[10px] uppercase font-bold tracking-wide", toastText === "text-muted-foreground" ? "text-muted-foreground" : "text-white/70")}>
          {isAttacker ? "Attacker" : "Defender"}
        </div>

        {/* Username */}
        <div className={cn("text-sm font-bold truncate", toastText)}>{username}</div>
      </div>

      {/* Content (damage/result) */}
      {children}
    </div>
  );
}
