"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number | string;
  currencyType?: "gold" | "community";
  currencySymbol?: string | null;
  currencyName?: string | null;
  showTooltip?: boolean;
  showIcon?: boolean;
  className?: string;
  iconClassName?: string;
  amountClassName?: string;
}

/**
 * Reusable currency display component for consistent formatting across the app.
 *
 * Usage:
 * - For gold: <CurrencyDisplay amount={100} currencyType="gold" />
 * - For community currency: <CurrencyDisplay amount={100} currencyType="community" currencySymbol="TEC" currencyName="TestCommunity Coin" />
 *
 * Features:
 * - Displays amount with proper formatting
 * - Shows currency symbol (Gold or community symbol)
 * - Optional tooltip with full currency name
 * - Optional coin icon
 * - Customizable styling
 */
export function CurrencyDisplay({
  amount,
  currencyType = "gold",
  currencySymbol,
  currencyName,
  showTooltip = true,
  showIcon = false,
  className,
  iconClassName,
  amountClassName,
}: CurrencyDisplayProps) {
  const formattedAmount = typeof amount === "number" ? amount.toLocaleString() : amount;
  const displaySymbol = currencyType === "gold" ? "Gold" : (currencySymbol || "CC");
  const tooltipText = currencyType === "gold" ? "Universal Gold Currency" : (currencyName || "Community Currency");

  const content = (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {showIcon && <Coins className={cn("size-4", iconClassName)} />}
      <span className={cn("font-medium", amountClassName)}>{formattedAmount}</span>
      <span className={cn("text-muted-foreground", amountClassName)}>{displaySymbol}</span>
    </span>
  );

  if (!showTooltip) {
    return content;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact currency display without tooltip (for use in tables, lists, etc.)
 */
export function CurrencyDisplayCompact({
  amount,
  currencyType = "gold",
  currencySymbol,
  className,
}: Pick<CurrencyDisplayProps, "amount" | "currencyType" | "currencySymbol" | "className">) {
  return (
    <CurrencyDisplay
      amount={amount}
      currencyType={currencyType}
      currencySymbol={currencySymbol}
      showTooltip={false}
      className={className}
    />
  );
}

/**
 * Currency display with icon (for prominent displays)
 */
export function CurrencyDisplayWithIcon({
  amount,
  currencyType = "gold",
  currencySymbol,
  currencyName,
  className,
}: Pick<CurrencyDisplayProps, "amount" | "currencyType" | "currencySymbol" | "currencyName" | "className">) {
  return (
    <CurrencyDisplay
      amount={amount}
      currencyType={currencyType}
      currencySymbol={currencySymbol}
      currencyName={currencyName}
      showIcon={true}
      className={className}
    />
  );
}
