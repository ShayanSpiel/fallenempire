"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ColorOption {
  id: string;
  label: string;
  color: string;
}

interface ColorSelectorProps {
  options: ColorOption[];
  selected: string;
  onChange: (value: string) => void;
  label: string;
}

export function ColorSelector({ options, selected, onChange, label }: ColorSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">{label}</div>
      <div className="grid grid-cols-6 md:grid-cols-8 gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={cn(
              "relative w-full aspect-square rounded-lg transition-all border-2",
              "hover:scale-110 hover:shadow-md",
              selected === option.id
                ? "border-primary ring-2 ring-primary/20 scale-105"
                : "border-border/40"
            )}
            style={{ backgroundColor: option.color }}
            title={option.label}
          >
            {selected === option.id && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Check
                  size={16}
                  className={cn(
                    "drop-shadow-lg",
                    // Use white check for dark colors, dark check for light colors
                    parseInt(option.color.replace('#', ''), 16) > 0x888888
                      ? "text-black"
                      : "text-white"
                  )}
                />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
