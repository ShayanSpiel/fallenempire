"use client"

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Plane,
  Loader2,
  Search,
  AlertCircle,
  Ticket,
  ChevronDown,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { calculateTravelCost } from "@/lib/travel"
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"

interface RegionSearchResult {
  hex_id: string
  province_name: string
  custom_name?: string
  community_name?: string
  owner_community_id?: string
  display_name: string
  searchable_text: string
}

interface TravelDropdownProps {
  userCurrentHex: string | null
  userTicketCount: number
  onTravelSuccess?: (hexId: string, locationName: string) => void
  onTravelStatusChange?: (status: "idle" | "loading" | "success" | "error", error?: string) => void
  currentLocationName?: string
}

// Cache for region data
let regionDataCache: RegionSearchResult[] | null = null
let regionDataLoadPromise: Promise<RegionSearchResult[]> | null = null

async function loadRegionData(): Promise<RegionSearchResult[]> {
  if (regionDataCache) return regionDataCache
  if (regionDataLoadPromise) return regionDataLoadPromise

  regionDataLoadPromise = (async () => {
    try {
      // Call the API endpoint to get all travel destinations via RPC
      const response = await fetch("/api/travel?type=destinations", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch destinations: ${response.statusText}`)
      }

      const data = await response.json()

      // The API should return an array of destinations
      regionDataCache = Array.isArray(data) ? (data as RegionSearchResult[]) : []

      return regionDataCache
    } catch (error) {
      console.error("Failed to load travel destinations:", error)
      regionDataCache = []
      return []
    }
  })()

  return regionDataLoadPromise
}

export function TravelDropdown({
  userCurrentHex,
  userTicketCount,
  onTravelSuccess,
  onTravelStatusChange,
  currentLocationName = "Unknown",
}: TravelDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<RegionSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [travelingHex, setTravelingHex] = useState<string | null>(null)
  const [arrivedHex, setArrivedHex] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Initialize region data and perform search
  useEffect(() => {
    if (!isOpen) return

    const initializeAndSearch = async () => {
      // Only show loading if data is not cached
      if (!regionDataCache) {
        setIsInitializing(true)
      }
      try {
        await loadRegionData()
      } catch (error) {
        console.error("Failed to initialize region data:", error)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeAndSearch()
  }, [isOpen])

  // Debounced search
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    if (!searchQuery.trim() || !isOpen) {
      setSearchResults([])
      return
    }

    setIsSearching(true)

    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const regions = await loadRegionData()
        const query = searchQuery.toLowerCase().trim()
        const results: RegionSearchResult[] = []

        for (const region of regions) {
          if (results.length >= 50) break

          // Search in the combined searchable text: Country • CustomName • Community + Hex ID
          // searchable_text already contains: province_name + custom_name + community_name + hex_id
          const matches = (region.searchable_text || "").includes(query)

          if (matches) {
            results.push(region)
          }
        }

        setSearchResults(results)
      } catch (error) {
        console.error("Search error:", error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 200)

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [searchQuery, isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false)
        setSearchQuery("")
      }
    }

    // Delay adding listener to avoid catching the initial click that opened the dropdown
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("click", handleClickOutside)
    }
  }, [isOpen])

  const handleTravel = useCallback(async (hexId: string) => {
    const selectedResult = searchResults.find((r) => r.hex_id === hexId)
    if (!selectedResult) return

    const travelCost = calculateTravelCost(userCurrentHex, hexId, userTicketCount)
    if (!travelCost.canTravel) return

    setTravelingHex(hexId)
    onTravelStatusChange?.("loading")

    try {
      const response = await fetch("/api/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationHex: hexId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Travel failed")
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Travel failed")
      }

      const locationName = selectedResult.display_name
      setTravelingHex(null)
      setArrivedHex(hexId)
      showSuccessToast(`Traveled to ${locationName}`)
      onTravelSuccess?.(hexId, locationName)
      onTravelStatusChange?.("success")

      setTimeout(() => {
        setIsOpen(false)
        setSearchQuery("")
        setSearchResults([])
        setArrivedHex(null)
        onTravelStatusChange?.("idle")
      }, 1500)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Travel failed"
      console.error("Travel error:", error)
      showErrorToast(errorMessage)
      setTravelingHex(null)
      onTravelStatusChange?.("error", errorMessage)
    }
  }, [searchResults, userCurrentHex, userTicketCount, onTravelSuccess, onTravelStatusChange])

  const handleButtonClick = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        onClick={handleButtonClick}
        size="sm"
        className="h-7 px-2.5 gap-1 rounded-md text-xs font-semibold transition-all border border-border/40 bg-transparent hover:bg-accent/50 text-foreground flex items-center whitespace-nowrap"
      >
        <Plane className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-xs">Travel</span>
        {userTicketCount > 0 && (
          <>
            <span className="text-border">•</span>
            <span className="flex items-center gap-1 text-xs">
              <Ticket className="h-2.5 w-2.5" />
              {userTicketCount}
            </span>
          </>
        )}
        <ChevronDown className="h-3 w-3 ml-0.5 transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-background border border-border rounded-lg shadow-lg z-50 pointer-events-auto">
          {/* Search Input */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                id="travel-search"
                aria-label="Search regions or hex coordinates"
                placeholder="Search regions or hex..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                }}
                className="pl-8 h-8 text-sm"
                autoFocus
                disabled={isInitializing}
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-[300px]">
            {isInitializing ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : searchQuery.trim() === "" ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Type to search for regions
              </div>
            ) : isSearching ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm px-4">
                <AlertCircle className="h-4 w-4 mb-2" />
                No regions found
              </div>
            ) : (
              <ScrollArea className="h-[250px]">
                <div className="divide-y divide-border/50">
                  {searchResults.map((region) => {
                    // Calculate cost from current location if available, otherwise show estimated cost
                    const cost = calculateTravelCost(userCurrentHex, region.hex_id, userTicketCount)
                    // For display purposes, if user hasn't traveled yet, calculate estimated cost from province center
                    const estimatedCost = !userCurrentHex && region.hex_id ? calculateTravelCost("0-0", region.hex_id, userTicketCount) : cost
                    const isCurrentLocation = userCurrentHex === region.hex_id
                    const canTravel = cost.canTravel && !isCurrentLocation
                    const isTravelingToThisHex = travelingHex === region.hex_id
                    const hasArrivedAtThisHex = arrivedHex === region.hex_id
                    const displayCost = !userCurrentHex ? estimatedCost : cost

                    return (
                      <button
                        key={region.hex_id}
                        onClick={() => canTravel && !isTravelingToThisHex && handleTravel(region.hex_id)}
                        disabled={!canTravel || isTravelingToThisHex || hasArrivedAtThisHex}
                        type="button"
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm transition-all flex items-center justify-between gap-2",
                          canTravel && !isTravelingToThisHex && !hasArrivedAtThisHex
                            ? "hover:bg-accent/20 cursor-pointer"
                            : "opacity-75 cursor-not-allowed"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate text-xs">
                            {(() => {
                              const regionName = region.custom_name || region.province_name || "Unknown";
                              const words = regionName.split(' ');
                              const truncated = words.length > 3 ? `${words.slice(0, 3).join(' ')}...` : regionName;
                              return region.community_name ? `${region.community_name} • ${truncated}` : truncated;
                            })()}
                          </div>
                          <div className="text-xs text-muted-foreground">{region.hex_id}</div>
                        </div>

                        {isCurrentLocation ? (
                          <span className="text-xs font-semibold text-accent whitespace-nowrap flex-shrink-0">
                            Here
                          </span>
                        ) : hasArrivedAtThisHex ? (
                          <div className="flex items-center gap-1 text-xs text-green-500 font-semibold whitespace-nowrap flex-shrink-0">
                            <Check className="h-3 w-3 fill-green-500" />
                            Arrived!
                          </div>
                        ) : isTravelingToThisHex ? (
                          <div className="flex items-center gap-1 text-xs text-blue-500 font-semibold whitespace-nowrap flex-shrink-0">
                            <Plane className="h-3 w-3" />
                            <span>Traveling...</span>
                            <Loader2 className="h-3 w-3 animate-spin" />
                          </div>
                        ) : displayCost.ticketsNeeded >= 0 ? (
                          <div className={cn(
                            "flex items-center gap-1 text-xs font-semibold whitespace-nowrap flex-shrink-0",
                            canTravel ? "text-green-500" : "text-red-500"
                          )}>
                            <Plane className="h-3 w-3" />
                            <Ticket className="h-3 w-3" />
                            <span>{displayCost.ticketsNeeded}</span>
                          </div>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Keep backward compatibility with modal export
export function TravelModal() {
  return null
}
