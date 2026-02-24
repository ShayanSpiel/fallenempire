"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { borders, layout } from "@/lib/design-system";

const PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef",
  "#f43f5e", "#71717a"
];

const RAINBOW_GRADIENT =
  "linear-gradient(135deg, #ef4444, #f97316, #f59e0b, #84cc16, #10b981, #06b6d4, #3b82f6, #8b5cf6, #d946ef)";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const normalizedValue = value.toLowerCase();
  const isPreset = PRESETS.some((preset) => preset.toLowerCase() === normalizedValue);

  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            `${layout.sizes.avatar.xs} rounded-full ${borders.thin} transition-all flex items-center justify-center`,
            value === color ? "border-foreground scale-110" : "border-transparent hover:scale-105"
          )}
          style={{ backgroundColor: color }}
        >
          {value === color && <Check className="w-4 h-4 text-white drop-shadow-md" />}
        </button>
      ))}
      <div
        className={cn(
          `relative flex items-center justify-center ${layout.sizes.avatar.xs} rounded-full overflow-hidden ${borders.thin} transition-all`,
          isPreset ? "border-border/50 hover:border-border" : "border-foreground scale-110"
        )}
        style={{ backgroundImage: RAINBOW_GRADIENT }}
      >
        <input 
          type="color" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 cursor-pointer opacity-0"
        />
        <div
          className="w-5 h-5 rounded-full border border-background shadow-inner"
          style={{ backgroundColor: value }}
        />
        {!isPreset && <Check className="absolute w-3 h-3 text-white drop-shadow-md" />}
      </div>
    </div>
  );
}
