"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface RegionNameProps {
  hexId: string;
  customName?: string | null;
  showId?: boolean;
  fallbackToHex?: boolean;
  className?: string;
  idClassName?: string;
  nameClassName?: string;
  variant?: "default" | "compact" | "large";
}

/**
 * RegionName - Consistent region name display component
 *
 * Displays region names with format: [Custom Name] #hexId
 * - Custom name is pre-populated with province/country name from geocoding
 * - Leaders can edit custom_name to override the default province name
 * - Falls back to hex ID if no custom name is set
 * - Hex ID is copyable for easy reference
 */
export function RegionName({
  hexId,
  customName,
  showId = true,
  fallbackToHex = true,
  className,
  idClassName,
  nameClassName,
  variant = "default",
}: RegionNameProps) {
  const [copied, setCopied] = useState(false);

  const fallbackName = fallbackToHex ? hexId : "";
  const displayName = customName?.trim() || fallbackName;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(hexId);
      setCopied(true);
      toast.success(`Hex ID ${hexId} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy hex ID");
    }
  };

  if (variant === "compact") {
    return (
      <div className={cn("inline-flex items-center gap-1.5", className)}>
        <span className={cn("text-sm font-medium", nameClassName)}>
          {displayName}
        </span>
        {showId && (
          <button
            onClick={handleCopy}
            className={cn(
              "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-mono bg-muted/50 text-muted-foreground hover:bg-muted transition-colors",
              idClassName
            )}
            title="Click to copy hex ID"
          >
            #{hexId}
            {copied ? (
              <Check className="h-2.5 w-2.5" />
            ) : (
              <Copy className="h-2.5 w-2.5 opacity-50" />
            )}
          </button>
        )}
      </div>
    );
  }

  if (variant === "large") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <h2 className={cn("text-lg font-bold", nameClassName)}>
          {displayName}
        </h2>
        {showId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className={cn(
              "h-7 gap-1.5 font-mono text-xs",
              idClassName
            )}
            title="Click to copy hex ID"
          >
            #{hexId}
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3 opacity-60" />
            )}
          </Button>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("text-sm font-semibold", nameClassName)}>
        {displayName}
      </span>
      {showId && (
        <Badge
          variant="outline"
          className={cn(
            "cursor-pointer font-mono text-[10px] hover:bg-muted transition-colors",
            idClassName
          )}
          onClick={handleCopy}
          title="Click to copy hex ID"
        >
          #{hexId}
          {copied ? (
            <Check className="ml-1 h-2.5 w-2.5" />
          ) : (
            <Copy className="ml-1 h-2.5 w-2.5 opacity-50" />
          )}
        </Badge>
      )}
    </div>
  );
}
