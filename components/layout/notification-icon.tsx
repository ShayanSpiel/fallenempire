"use client";

import { FC, useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationCounts } from "@/lib/hooks/use-notifications";
import { NotificationCounts } from "@/lib/types/notifications";

interface NotificationIconProps {
  className?: string;
  counts?: NotificationCounts;
}

const ICON_SIZE = 32

export const NotificationIcon: FC<NotificationIconProps> = ({
  className,
  counts: countsProp,
}) => {
  const shouldUseHook = countsProp === undefined;
  const { counts: hookCounts, loading: hookLoading } = useNotificationCounts(shouldUseHook);
  const counts = countsProp ?? hookCounts;
  const [isAnimating, setIsAnimating] = useState(false);
  const prevCountRef = useRef(counts.total);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [shouldAnimateOnMount, setShouldAnimateOnMount] = useState(false);
  // Only show "no notifications" if we've hydrated AND aren't loading AND count is 0
  const hasNotifications = hasHydrated && !hookLoading && counts.total > 0;
  const hydrateAnimationTriggeredRef = useRef(false);

  console.log("[NotificationIcon] Rendering with counts:", counts, "shouldUseHook:", shouldUseHook);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!shouldAnimateOnMount) return;
    const timer = setTimeout(() => {
      setShouldAnimateOnMount(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [shouldAnimateOnMount]);

  // Trigger ring animation when new notifications arrive
  useEffect(() => {
    console.log("[NotificationIcon] Count changed:", {
      prev: prevCountRef.current,
      current: counts.total,
    });
    if (counts.total > prevCountRef.current) {
      // New notification arrived
      console.log("[NotificationIcon] Triggering ring animation");
      const rafId = requestAnimationFrame(() => setIsAnimating(true));
      const timer = setTimeout(() => setIsAnimating(false), 1200);
      prevCountRef.current = counts.total;
      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timer);
      };
    }
    prevCountRef.current = counts.total;
  }, [counts.total]);

  useEffect(() => {
    if (!hasHydrated || counts.total === 0 || hydrateAnimationTriggeredRef.current) {
      return;
    }
    hydrateAnimationTriggeredRef.current = true;
    setShouldAnimateOnMount(true);
  }, [hasHydrated, counts.total]);

  const shouldShake = isAnimating || shouldAnimateOnMount;

  return (
    <div
      className={cn(
        "relative inline-flex w-full h-full items-center justify-center overflow-visible",
        className
      )}
    >
      {/* Bell icon with ring animation and 3D golden styling */}
      <div
        className={cn(
          "relative flex items-center justify-center transition-all duration-200",
          shouldShake && "animate-bell-shake"
        )}
      >
        <Bell
          size={ICON_SIZE}
          className={cn(
            "h-8 w-8 transition-all duration-200",
            hasNotifications
              ? "text-amber-500"
              : "text-muted-foreground"
          )}
          fill={hasNotifications ? "#f59e0b" : "none"}
        />

        {hasNotifications && (
          <span
            className={cn(
              "absolute top-0 right-0 flex items-center justify-center",
              "translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5",
              "rounded-full bg-gradient-to-br from-red-500 to-red-600",
              "text-[9px] font-semibold leading-none tracking-tight text-white",
              "pointer-events-none shadow-lg"
            )}
            aria-label={`${counts.total} unread notifications`}
          >
            {counts.total > 99 ? "99+" : counts.total}
          </span>
        )}
      </div>

      {/* Bell shake animation keyframes */}
      <style>{`
        @keyframes bell-shake {
          0% { transform: rotate(0deg); }
          5% { transform: rotate(15deg); }
          10% { transform: rotate(-15deg); }
          15% { transform: rotate(13deg); }
          20% { transform: rotate(-13deg); }
          25% { transform: rotate(11deg); }
          30% { transform: rotate(-11deg); }
          35% { transform: rotate(9deg); }
          40% { transform: rotate(-9deg); }
          45% { transform: rotate(7deg); }
          50% { transform: rotate(-7deg); }
          55% { transform: rotate(5deg); }
          60% { transform: rotate(-5deg); }
          65% { transform: rotate(3deg); }
          70% { transform: rotate(-3deg); }
          75% { transform: rotate(2deg); }
          80% { transform: rotate(-2deg); }
          85% { transform: rotate(1deg); }
          90% { transform: rotate(-1deg); }
          95% { transform: rotate(0.5deg); }
          100% { transform: rotate(0deg); }
        }

        .animate-bell-shake {
          animation: bell-shake 0.8s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
          transform-origin: top center;
        }
      `}</style>
    </div>
  );
};

export default NotificationIcon;
