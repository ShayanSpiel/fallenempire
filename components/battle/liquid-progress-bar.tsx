"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Info, Clock, AlertCircle, CheckCircle2, Flame } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LiquidProgressBarProps {
  /**
   * Progress value (0-100)
   * - For disarray/exhaustion: 0 = bad, 100 = recovered
   * - For rage: 100 = full, 0 = empty
   */
  value: number;

  /**
   * Size of the circular indicator (in pixels)
   */
  size?: number;

  /**
   * Liquid color gradient
   * - disarray: from red/blood to green
   * - exhaustion: from amber/red to green
   * - rage: red-amber gradient
   */
  liquidColor: {
    low: string; // Color at low progress (e.g., "#ef4444" for red)
    high: string; // Color at high progress (e.g., "#22c55e" for green)
  };

  /**
   * Background circle color (should be a CSS variable or color-mix expression)
   */
  backgroundColor?: string;

  /**
   * Whether the progress fills from bottom to top (disarray/exhaustion)
   * or drains from top to bottom (rage)
   */
  fillDirection?: "up" | "down";

  /**
   * Label displayed below the circle
   */
  label: string;

  /**
   * Descriptive text (e.g., "3x energy cost" or "Fully recovered")
   */
  description: string;

  /**
   * Time remaining text (e.g., "2 hours until recovery")
   */
  timeRemaining?: string;

  /**
   * Tooltip explaining the mechanic
   */
  tooltipContent: React.ReactNode;

  /**
   * Status state for icon display
   */
  status?: "active" | "recovering" | "ready" | "critical";

  className?: string;
}

export function LiquidProgressBar({
  value,
  size = 120,
  liquidColor,
  backgroundColor = "hsl(var(--card))",
  fillDirection = "up",
  label,
  description,
  timeRemaining,
  tooltipContent,
  status = "ready",
  className,
}: LiquidProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, value));

  // Calculate liquid height based on fill direction
  const liquidHeight = fillDirection === "up" ? percentage : 100 - percentage;

  // Use CSS color-mix for theme-aware color interpolation
  const currentLiquidColor = `color-mix(in srgb, ${liquidColor.high} ${percentage}%, ${liquidColor.low} ${100 - percentage}%)`;

  // Get status icon
  const getStatusIcon = () => {
    switch (status) {
      case "critical":
        return <AlertCircle className="w-3 h-3" />;
      case "active":
        return <Flame className="w-3 h-3" />;
      case "recovering":
        return <Clock className="w-3 h-3" />;
      case "ready":
        return <CheckCircle2 className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Circular Liquid Indicator */}
      <div className="relative" style={{ width: size, height: size }}>
        {/* Single sharp minimal border - consistent with app design */}
        <div className="absolute inset-0 rounded-full border-2 border-border/60" />

        {/* Background Circle - Liquid container */}
        <div
          className="absolute inset-[3px] rounded-full shadow-inner overflow-hidden"
          style={{
            backgroundColor,
          }}
        >
          {/* Liquid Fill Base - Solid background with inner content */}
          <div
            className="absolute inset-x-0 bottom-0 transition-all duration-700 ease-out"
            style={{
              height: `${liquidHeight}%`,
              backgroundColor: currentLiquidColor,
              transformOrigin: "bottom",
            }}
          >
            {/* Bubbles */}
            <div
              className="absolute bottom-[10%] left-[20%] w-3 h-3 rounded-full opacity-30"
              style={{
                backgroundColor: currentLiquidColor,
                filter: 'brightness(1.3)',
                animation: "bubbleRise1 4s ease-in infinite",
              }}
            />
            <div
              className="absolute bottom-[5%] right-[25%] w-2.5 h-2.5 rounded-full opacity-25"
              style={{
                backgroundColor: currentLiquidColor,
                filter: 'brightness(1.3)',
                animation: "bubbleRise2 5s ease-in infinite",
                animationDelay: "1s",
              }}
            />
            <div
              className="absolute bottom-[15%] left-[60%] w-2 h-2 rounded-full opacity-20"
              style={{
                backgroundColor: currentLiquidColor,
                filter: 'brightness(1.3)',
                animation: "bubbleRise3 3.5s ease-in infinite",
                animationDelay: "2s",
              }}
            />
            <div
              className="absolute bottom-[8%] left-[45%] w-2.5 h-2.5 rounded-full opacity-25"
              style={{
                backgroundColor: currentLiquidColor,
                filter: 'brightness(1.3)',
                animation: "bubbleRise1 4.5s ease-in infinite",
                animationDelay: "2.5s",
              }}
            />

            {/* Shimmer effect */}
            <div
              className="absolute inset-0 opacity-10 mix-blend-overlay"
              style={{
                backgroundImage: `linear-gradient(135deg, transparent 40%, ${currentLiquidColor} 50%, transparent 60%)`,
                backgroundSize: "200% 200%",
                backgroundRepeat: "no-repeat",
                animation: "liquidShimmer 3s ease-in-out infinite",
              }}
            />
          </div>

          {/* Wave effect - simple oscillating wave at liquid surface */}
          <div
            className="absolute inset-x-0 pointer-events-none"
            style={{
              bottom: `${liquidHeight}%`,
              height: '16px',
              transform: 'translateY(8px)',
              overflow: 'hidden',
            }}
          >
            <div
              className="absolute w-[120%]"
              style={{
                left: "-10%",
                top: "0",
                height: "16px",
                backgroundColor: currentLiquidColor,
                borderRadius: "50%",
                animation: "wave 4s ease-in-out infinite",
              }}
            />
          </div>


          {/* Sharp arc curve highlight - positioned at 45deg top-left, only arc visible */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: '-20%',
              left: '-10%',
              width: '80%',
              height: '80%',
              background: 'radial-gradient(circle at 70% 70%, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.15) 40%, transparent 65%)',
              borderRadius: '50%',
              transform: 'rotate(-45deg)',
            }}
          />

          {/* Percentage Text Overlay */}
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <span
              className="text-2xl font-black tabular-nums text-foreground"
              style={{
                filter: 'drop-shadow(0 2px 4px hsl(var(--background) / 0.8))',
              }}
            >
              {Math.round(percentage)}%
            </span>
          </div>
        </div>

        {/* Info Icon - Minimal and interactive */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-muted hover:border-foreground/20 transition-all z-20"
                onClick={(e) => e.stopPropagation()}
              >
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                {tooltipContent}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Label and Status - Improved scannability */}
      <div className="text-center space-y-1.5 w-full max-w-[200px]">
        <div className="flex items-center justify-center gap-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">
            {label}
          </p>
          <span className="text-foreground/60" style={{ color: currentLiquidColor }}>
            {getStatusIcon()}
          </span>
        </div>

        <p className="text-sm font-semibold text-foreground/90 leading-tight">
          {description}
        </p>

        {timeRemaining && (
          <div className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{timeRemaining}</span>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes wave {
          0%, 100% {
            transform: translateX(0) translateY(0);
          }
          50% {
            transform: translateX(-8%) translateY(1px);
          }
        }

        @keyframes liquidShimmer {
          0%, 100% {
            background-position: 0% 0%;
          }
          50% {
            background-position: 100% 100%;
          }
        }

        @keyframes liquidSwirl {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes bubbleRise1 {
          0% {
            transform: translateY(0) scale(0.8);
            opacity: 0;
          }
          10% {
            opacity: 0.4;
          }
          90% {
            opacity: 0.2;
          }
          100% {
            transform: translateY(-400%) translateX(20%) scale(0.3);
            opacity: 0;
          }
        }

        @keyframes bubbleRise2 {
          0% {
            transform: translateY(0) scale(0.8);
            opacity: 0;
          }
          10% {
            opacity: 0.35;
          }
          90% {
            opacity: 0.15;
          }
          100% {
            transform: translateY(-450%) translateX(-15%) scale(0.2);
            opacity: 0;
          }
        }

        @keyframes bubbleRise3 {
          0% {
            transform: translateY(0) scale(0.8);
            opacity: 0;
          }
          10% {
            opacity: 0.3;
          }
          90% {
            opacity: 0.1;
          }
          100% {
            transform: translateY(-500%) translateX(10%) scale(0.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
