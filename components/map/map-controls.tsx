"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Box, Map as MapIcon, Plus, Minus, Layers, Lightbulb, LightbulbOff, Swords } from "lucide-react";

type Props = {
  is3DMode: boolean;
  enableLighting: boolean;
  showBackgroundMap: boolean;
  onToggle3D: () => void;
  onToggleLighting: () => void;
  onToggleBackground: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  battleListVisible: boolean;
  onToggleBattleList: () => void;
};

export default function MapControls({
  is3DMode,
  enableLighting,
  showBackgroundMap,
  onToggle3D,
  onToggleLighting,
  onToggleBackground,
  onZoomIn,
  onZoomOut,
  battleListVisible,
  onToggleBattleList,
}: Props) {
  return (
    <div className="absolute top-6 right-6 z-20">
      <div className="rounded-xl p-2 shadow-xl border border-border/40 bg-background/70 backdrop-blur-md">
        <div className="flex flex-col gap-2">
          <Button
            variant={is3DMode ? "default" : "secondary"}
            size="icon"
            onClick={onToggle3D}
            className="h-10 w-10 rounded-xl"
            aria-label={is3DMode ? "Switch to 2D" : "Switch to 3D"}
          >
            {is3DMode ? <Box className="h-5 w-5" /> : <MapIcon className="h-5 w-5" />}
          </Button>

          <Button
            variant={enableLighting ? "default" : "secondary"}
            size="icon"
            onClick={onToggleLighting}
            className="h-10 w-10 rounded-xl"
            aria-label={enableLighting ? "Lights Off" : "Lights On"}
          >
            {enableLighting ? <Lightbulb className="h-5 w-5" /> : <LightbulbOff className="h-5 w-5" />}
          </Button>

          <Button
            variant={showBackgroundMap ? "default" : "secondary"}
            size="icon"
            onClick={onToggleBackground}
            className="h-10 w-10 rounded-xl"
            aria-label={showBackgroundMap ? "Hide base map" : "Show base map"}
          >
            <Layers className="h-5 w-5" />
          </Button>

          <Button
            variant={battleListVisible ? "default" : "secondary"}
            size="icon"
            onClick={onToggleBattleList}
            className="h-10 w-10 rounded-xl"
            aria-label={battleListVisible ? "Hide battle list" : "Show battle list"}
          >
            <Swords className="h-5 w-5" />
          </Button>

          <div className="h-px bg-border/40 my-1" />

          <Button
            variant="secondary"
            size="icon"
            onClick={onZoomIn}
            className="h-10 w-10 rounded-xl"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={onZoomOut}
            className="h-10 w-10 rounded-xl"
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
