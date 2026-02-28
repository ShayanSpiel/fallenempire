"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type UserTier, getAvailableThemes } from "@/lib/subscriptions/types";

type Theme = "light" | "dark" | "discord-dark";

interface ThemeOption {
  value: Theme;
  label: string;
  icon: React.ReactNode;
  description: string;
  gradient: string;
  previewColors: {
    bg: string;
    card: string;
    primary: string;
  };
  requiredTier: UserTier;
}

const themeOptions: ThemeOption[] = [
  {
    value: "light",
    label: "Cream",
    icon: <Sun className="h-5 w-5" />,
    description: "Warm amber & orange theme",
    gradient: "from-amber-400 via-orange-400 to-amber-500",
    previewColors: {
      bg: "#fff9f0",
      card: "#fffdf6",
      primary: "#facc15",
    },
    requiredTier: "alpha" as UserTier,
  },
  {
    value: "dark",
    label: "Blue",
    icon: <Moon className="h-5 w-5" />,
    description: "Cool blue dark theme",
    gradient: "from-blue-600 via-sky-500 to-blue-700",
    previewColors: {
      bg: "#030b1f",
      card: "#0b1d3a",
      primary: "#38bdf8",
    },
    requiredTier: "sigma" as UserTier,
  },
  {
    value: "discord-dark",
    label: "Discord",
    icon: <Monitor className="h-5 w-5" />,
    description: "Neutral gray dark theme",
    gradient: "from-gray-700 via-gray-600 to-gray-800",
    previewColors: {
      bg: "#313338",
      card: "#2b2d31",
      primary: "#5865f2",
    },
    requiredTier: "omega" as UserTier,
  },
];

interface ThemeSelectorProps {
  userTier?: UserTier;
}

export function ThemeSelector({ userTier = "alpha" }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const getTierLevel = (tier: UserTier): number => {
    return { alpha: 0, sigma: 1, omega: 2 }[tier] || 0;
  };

  const handleThemeClick = (option: ThemeOption) => {
    const userLevel = getTierLevel(userTier);
    const requiredLevel = getTierLevel(option.requiredTier);

    if (userLevel >= requiredLevel) {
      setTheme(option.value);
    } else {
      // Redirect to subscribe page
      router.push("/subscribe");
    }
  };

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Theme</h3>
        <p className="text-sm text-muted-foreground">
          Choose your preferred color scheme for the interface
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {themeOptions.map((option) => {
          const isSelected = theme === option.value;
          const userLevel = getTierLevel(userTier);
          const requiredLevel = getTierLevel(option.requiredTier);
          const isLocked = userLevel < requiredLevel;

          return (
            <button
              key={option.value}
              onClick={() => handleThemeClick(option)}
              className={cn(
                "relative group flex flex-col gap-3 p-4 rounded-xl border-2 transition-all duration-200",
                "hover:scale-[1.02] active:scale-[0.98]",
                isSelected
                  ? "border-primary bg-primary/5 shadow-lg"
                  : "border-border bg-card hover:border-primary/50 hover:bg-accent/30",
                isLocked && "opacity-60 hover:opacity-80"
              )}
            >
              {/* Theme Preview */}
              <div className="relative h-20 rounded-lg overflow-hidden shadow-sm">
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${option.previewColors.bg} 0%, ${option.previewColors.card} 100%)`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center gap-2 p-3">
                    <div
                      className="h-8 w-8 rounded-md shadow-md"
                      style={{ backgroundColor: option.previewColors.card }}
                    />
                    <div
                      className="h-8 flex-1 rounded-md shadow-md"
                      style={{ backgroundColor: option.previewColors.primary }}
                    />
                  </div>
                </div>
                {isSelected && !isLocked && (
                  <div className="absolute top-2 right-2 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
                )}
                {isLocked && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                    <Lock className="h-8 w-8 text-white drop-shadow-lg" />
                  </div>
                )}
              </div>

              {/* Theme Info */}
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex items-center justify-center h-10 w-10 rounded-lg",
                    `bg-gradient-to-br ${option.gradient} text-white shadow-md`
                  )}
                >
                  {option.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    {option.label}
                    {isLocked && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                        {option.requiredTier === "sigma" ? "Sigma" : "Omega"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
