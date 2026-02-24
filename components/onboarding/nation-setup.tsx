"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Sparkles } from "lucide-react";

interface NationSetupProps {
  onSubmit: (data: { nationName: string; color: string }) => Promise<void>;
  isLoading?: boolean;
}

const suggestedColors = [
  { name: "Imperial Gold", hex: "#facc15" },
  { name: "Sovereign Red", hex: "#dc2626" },
  { name: "Royal Blue", hex: "#3b82f6" },
  { name: "Emerald Green", hex: "#10b981" },
  { name: "Purple Majesty", hex: "#9333ea" },
  { name: "Orange Fire", hex: "#f59e0b" },
  { name: "Crimson", hex: "#ef4444" },
  { name: "Cyan", hex: "#06b6d4" },
];

export function NationSetup({ onSubmit, isLoading = false }: NationSetupProps) {
  const [nationName, setNationName] = useState("");
  const [selectedColor, setSelectedColor] = useState(suggestedColors[0].hex);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nationName.trim()) {
      setError("Please enter a nation name");
      return;
    }

    if (nationName.length < 3) {
      setError("Nation name must be at least 3 characters");
      return;
    }

    if (nationName.length > 50) {
      setError("Nation name must be less than 50 characters");
      return;
    }

    try {
      await onSubmit({
        nationName: nationName.trim(),
        color: selectedColor,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create nation");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Name Your Nation</h2>
        <p className="text-sm text-muted-foreground">
          Choose a name and color that represents your empire's identity
        </p>
      </div>

      {/* Nation Name */}
      <div className="space-y-3">
        <Label htmlFor="nation-name" className="text-sm font-semibold text-foreground">
          Nation Name
        </Label>
        <Input
          id="nation-name"
          type="text"
          placeholder="e.g., Britannia, New Rome, Azure State"
          value={nationName}
          onChange={(e) => {
            setNationName(e.target.value);
            setError(null);
          }}
          disabled={isLoading}
          maxLength={50}
          className="text-lg font-semibold transition-all focus:ring-2 focus:ring-primary/50"
          autoFocus
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            This is the official name of your nation
          </p>
          <p className="text-xs text-muted-foreground">
            {nationName.length}/50
          </p>
        </div>
      </div>

      {/* National Color */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">
          National Colors
        </Label>
        <p className="text-xs text-muted-foreground">
          Choose a color to represent your nation on the map and in UI elements
        </p>

        <div className="grid grid-cols-4 gap-3">
          {suggestedColors.map((color) => (
            <button
              key={color.hex}
              type="button"
              onClick={() => setSelectedColor(color.hex)}
              disabled={isLoading}
              className={`group relative h-12 rounded-lg transition-all duration-200 ${
                selectedColor === color.hex
                  ? "ring-2 ring-foreground ring-offset-2"
                  : "hover:scale-105"
              }`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            >
              {selectedColor === color.hex && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-white shadow-lg"></div>
                </div>
              )}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground/90 px-2 py-1 text-xs font-semibold text-background opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                {color.name}
              </div>
            </button>
          ))}
        </div>

        {/* Custom color option */}
        <div className="mt-4 space-y-2">
          <Label htmlFor="custom-color" className="text-xs font-semibold text-muted-foreground">
            Or enter a custom color
          </Label>
          <div className="flex gap-2">
            <input
              id="custom-color"
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              disabled={isLoading}
              className="h-10 w-20 rounded-lg cursor-pointer border border-border"
            />
            <input
              type="text"
              value={selectedColor.toUpperCase()}
              onChange={(e) => {
                const value = e.target.value;
                if (/^#[0-9A-F]{6}$/i.test(value)) {
                  setSelectedColor(value);
                }
              }}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-mono text-foreground"
              placeholder="#FACC15"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <Card variant="subtle" className="p-4">
        <p className="text-xs font-semibold text-muted-foreground mb-3">Preview</p>
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-lg border-2 border-border transition-all"
            style={{ backgroundColor: selectedColor }}
          ></div>
          <div>
            <p className="text-lg font-bold text-foreground">
              {nationName || "Your Nation"}
            </p>
            <p className="text-xs text-muted-foreground">
              Hex: {selectedColor.toUpperCase()}
            </p>
          </div>
        </div>
      </Card>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Submit button */}
      <Button
        type="submit"
        disabled={isLoading || !nationName.trim()}
        className="w-full gap-2 font-semibold"
        size="lg"
      >
        <Sparkles className="h-4 w-4" />
        {isLoading ? "Creating Nation..." : "Create Nation & Begin Campaign"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You can change your nation's name and colors later in settings
      </p>
    </form>
  );
}
