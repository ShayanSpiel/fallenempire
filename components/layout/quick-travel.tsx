"use client"

import React from "react"
import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { TravelDropdown } from "@/components/layout/travel-modal"

interface QuickTravelProps {
  currentLocationName?: string
  userCurrentHex?: string | null
  userTicketCount?: number
  onTravelSuccess?: (hexId: string, locationName: string) => void
  onTravelStatusChange?: (status: "idle" | "loading" | "success" | "error", error?: string) => void
  className?: string
}

export function QuickTravel({
  currentLocationName = "Unknown",
  userCurrentHex,
  userTicketCount = 0,
  onTravelSuccess,
  onTravelStatusChange,
  className,
}: QuickTravelProps) {
  // Only show location if it's not the default "Unknown" value
  const hasValidLocation = currentLocationName && currentLocationName !== "Unknown"

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm font-semibold text-foreground flex-shrink-0",
        className
      )}
    >
      {/* Location Display - only show if we have a valid location */}
      {hasValidLocation && (
        <>
          <div className="flex items-center gap-1 flex-nowrap">
            <MapPin className="h-4 w-4 text-red-500 flex-shrink-0" />
            <span className="truncate max-w-[150px] text-sm font-semibold">
              {currentLocationName}
            </span>
          </div>

          {/* Bullet separator */}
          <span className="text-border text-xs">•</span>
        </>
      )}

      {/* Travel Dropdown Button */}
      <TravelDropdown
        userCurrentHex={userCurrentHex || null}
        userTicketCount={userTicketCount}
        onTravelSuccess={onTravelSuccess}
        onTravelStatusChange={onTravelStatusChange}
        currentLocationName={currentLocationName}
      />
    </div>
  )
}
