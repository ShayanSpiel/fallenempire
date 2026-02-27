"use client"

import * as React from "react"
import {
  ChevronDown,
  Loader2,
  Pin,
  PinOff,
  Mail,
  Heart,
  HeartHandshake,
  Plus,
  Sun,
  Moon,
  Utensils,
  Dumbbell,
  Smile,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { trainAction } from "@/app/actions/training"
import { showLevelUpToast } from "@/components/progression/level-up-toast"
import { ENERGY_CAP, ENERGY_REGEN_PER_HOUR } from "@/lib/gameplay/constants"
import { useUserStats } from "@/lib/hooks/useUserStats"
import { showErrorToast, showInfoToast } from "@/lib/toast-utils"
import { normalizeStrength, STRENGTH_DISPLAY_PRECISION } from "@/lib/gameplay/strength"
import { getUserWallet } from "@/app/actions/economy"
import type { WalletDisplay } from "@/lib/types/economy"
import { GoldCoinIcon, CommunityCoinIcon } from "@/components/ui/coin-icon"
import { QuickTravel } from "@/components/layout/quick-travel"
import { useOptionalUserVitals } from "@/components/layout/user-vitals"

interface StatsDrawerProps {
  isOpen: boolean
  isPinned: boolean
  onToggle: () => void
  onTogglePin: () => void
  children?: React.ReactNode
  userId?: string
  userAvatar?: string
  userName?: string
  energy?: number
  energyCap?: number
  energyPerHour?: number
  unreadMessagesCount?: number
  canTrain?: boolean
  lastTrainedAt?: string | null
  mentalPower?: number
  morale?: number
  strength?: number
  currentMilitaryRank?: string | null
}

function normalizeMorale(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 50
  }

  return Math.round(Math.max(0, Math.min(100, value)))
}

function moraleToPercent(morale: number): number {
  const clamped = Math.max(-100, Math.min(100, morale))
  return ((clamped + 100) / 200) * 100
}

function getMoraleColor(morale: number): string {
  const normalized = moraleToPercent(morale)

  if (normalized <= 20) {
    return `hsl(0, 100%, ${55 - (20 - normalized) * 0.5}%)`
  }
  if (normalized <= 50) {
    const progress = (normalized - 20) / 30
    const hue = progress * 40
    const saturation = 100 - progress * 10
    const lightness = 45 + progress * 5
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }
  if (normalized <= 80) {
    const progress = (normalized - 50) / 30
    const hue = 40 + progress * 80
    const saturation = 90 - progress * 30
    const lightness = 50 - progress * 5
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }

  return `hsl(120, 70%, ${50 - (100 - normalized) * 0.3}%)`
}

function StatItem({
  label,
  icon,
  children,
  className,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-semibold text-foreground",
              className,
            )}
          >
            {icon}
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

type RightLayoutStage = "default" | "compact" | "mini"

interface QuickStatsRowProps {
  className?: string
  showRank: boolean
  rowRef?: React.Ref<HTMLDivElement>
  showMorale: boolean
  moraleValue: number
  moraleColor: string
  hideLeftActions?: boolean
  isDay: boolean
  formattedTime: string
  unreadMessagesCount: number
  userCurrentLocationName: string
  userCurrentHex: string | null
  userTicketCount: number
  onTravelSuccess: (hexId: string, locationName: string) => void
  onTravelStatusChange: (status: "idle" | "loading" | "success" | "error", error?: string) => void
  iconButtonClass: string
  messageBadgeClass: string
  separatorClass: string
  progressBarOuterClass: string
  progressBarInnerClass: string
}

function QuickStatsRow({
  className,
  showRank,
  rowRef,
  showMorale,
  moraleValue,
  moraleColor,
  hideLeftActions = false,
  isDay,
  formattedTime,
  unreadMessagesCount,
  userCurrentLocationName,
  userCurrentHex,
  userTicketCount,
  onTravelSuccess,
  onTravelStatusChange,
  iconButtonClass,
  messageBadgeClass,
  separatorClass,
  progressBarOuterClass,
  progressBarInnerClass,
}: QuickStatsRowProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-start gap-3 text-sm font-semibold flex-nowrap",
        className,
      )}
      ref={rowRef}
    >
      {/* Left: Time and Messages - Fixed */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-nowrap justify-start">
        {!hideLeftActions && (
          <>
            <div className="flex items-center gap-1 text-sm font-bold font-mono">
              {isDay ? (
                <Sun className="h-3 w-3 text-amber-500" />
              ) : (
                <Moon className="h-3 w-3 text-blue-400" />
              )}
              <span className="text-sm font-bold font-mono text-foreground">
                {formattedTime}
              </span>
            </div>
            <Link href="/messages" className="relative">
              <Button
                variant="ghost"
                size="icon"
                className={iconButtonClass}
                aria-label="View messages"
              >
                <Mail className="h-3.5 w-3.5" />
              </Button>
              {unreadMessagesCount > 0 && (
                <span className={messageBadgeClass}>
                  {unreadMessagesCount > 9 ? "9+" : unreadMessagesCount}
                </span>
              )}
            </Link>
          </>
        )}
      </div>

      <div className={separatorClass} aria-hidden />

      {/* Middle: Quick Travel - Fixed, Always Visible */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-nowrap justify-start">
        <QuickTravel
          currentLocationName={userCurrentLocationName}
          userCurrentHex={userCurrentHex}
          userTicketCount={userTicketCount}
          onTravelSuccess={onTravelSuccess}
          onTravelStatusChange={onTravelStatusChange}
          className="flex-shrink-0"
        />
      </div>

      <div className={separatorClass} aria-hidden />

      {/* Right: Morale Bar - Disappears on small screens, Right-aligned */}
      {showMorale && (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-semibold font-mono text-foreground">
            <div className="flex items-center gap-1 min-w-0">
              <Smile className="h-3 w-3 flex-shrink-0" style={{ color: moraleColor }} />
              <span className="truncate" style={{ color: moraleColor }}>
                {moraleValue}%
              </span>
            </div>
            <span className="text-muted-foreground flex-shrink-0 flex items-center gap-1">
              <HeartHandshake className="h-3 w-3 text-amber-400" />
              Morale
            </span>
          </div>
          <div className={progressBarOuterClass}>
            <div
              className={progressBarInnerClass}
              style={{ width: `${moraleValue}%`, backgroundColor: moraleColor }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function StatsDrawer({
  isOpen,
  isPinned,
  onToggle,
  onTogglePin,
  children,
  userId,
  userAvatar,
  userName,
  energy = ENERGY_CAP,
  energyCap = ENERGY_CAP,
  energyPerHour = ENERGY_REGEN_PER_HOUR,
  unreadMessagesCount = 0,
  canTrain: initialCanTrain = true,
  mentalPower,
  morale,
  strength,
  currentMilitaryRank,
  lastTrainedAt,
}: StatsDrawerProps) {
  // Subscribe to real-time user stats
  const { stats: realtimeStats, refetch: refetchStats } = useUserStats(userId)

  // Get energy vitals context for global energy updates
  const vitalsContext = useOptionalUserVitals()

  const [currentTime, setCurrentTime] = React.useState<Date | null>(null)
  const [displayEnergy, setDisplayEnergy] = React.useState(energy)
  const [isTraining, setIsTraining] = React.useState(false)
  const [canTrain, setCanTrain] = React.useState(initialCanTrain)
  const [wallet, setWallet] = React.useState<WalletDisplay | null>(null)
  const [userCurrentHex, setUserCurrentHex] = React.useState<string | null>(null)
  const [userTicketCount, setUserTicketCount] = React.useState(0)
  const [userCurrentLocationName, setUserCurrentLocationName] = React.useState("Unknown")
  const [travelStatus, setTravelStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle")
  const [travelError, setTravelError] = React.useState<string | undefined>()
  const [foodQuality, setFoodQuality] = React.useState<number | null>(null)
  const [isEating, setIsEating] = React.useState(false)

  // Get food count from vitals context (single source of truth)
  const foodCount = vitalsContext?.foodCount ?? 0

  // Update server time every second (only after the component mounts)
  React.useEffect(() => {
    const updateTime = () => setCurrentTime(new Date())
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Update energy when prop changes
  React.useEffect(() => {
    setDisplayEnergy(energy)
  }, [energy])

  // Update display energy when realtime stats change
  React.useEffect(() => {
    if (realtimeStats?.energy !== undefined) {
      setDisplayEnergy(realtimeStats.energy)
    }
  }, [realtimeStats?.energy])

  // Update canTrain based on lastTrainedAt
  React.useEffect(() => {
    if (!lastTrainedAt) {
      setCanTrain(true)
      return
    }
    const now = new Date()
    const lastTrained = new Date(lastTrainedAt)
    const isSameDay =
      lastTrained.getUTCFullYear() === now.getUTCFullYear() &&
      lastTrained.getUTCMonth() === now.getUTCMonth() &&
      lastTrained.getUTCDate() === now.getUTCDate()
    setCanTrain(!isSameDay)
  }, [lastTrainedAt])

  // Fetch wallet data
  React.useEffect(() => {
    if (!userId) return

    getUserWallet(userId).then((data) => {
      if (data) {
        setWallet(data)
      }
    }).catch((error) => {
      console.error('Error fetching wallet:', error)
    })
  }, [userId])

  // Fetch user location
  React.useEffect(() => {
    if (!userId) return

    const fetchLocationAndTickets = async () => {
      try {
        // Fetch location
        const locationResponse = await fetch("/api/travel")
        if (locationResponse.ok) {
          const locationData = await locationResponse.json()
          if (locationData && locationData.has_location) {
            setUserCurrentHex(locationData.hex_id || null)
            const displayName = locationData.custom_name || locationData.province_name || locationData.hex_id || "Unknown"
            setUserCurrentLocationName(displayName)
          }
        }

        // Fetch travel tickets from inventory
        const inventoryResponse = await fetch("/api/inventory?type=ticket")
        if (inventoryResponse.ok) {
          const inventoryData = await inventoryResponse.json()
          if (inventoryData && inventoryData.quantity) {
            setUserTicketCount(inventoryData.quantity)
          }
        }
      } catch (error) {
        console.error("Error fetching location or tickets:", error)
      }
    }

    fetchLocationAndTickets()
  }, [userId])

  // Format time as HH:MM
  const formattedTime = React.useMemo(() => {
    if (!currentTime) {
      return '--:--'
    }
    const hours = currentTime.getHours().toString().padStart(2, '0')
    const minutes = currentTime.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }, [currentTime])

  // Determine day or night
  const isDay = React.useMemo(() => {
    if (!currentTime) {
      return true
    }
    const hours = currentTime.getHours()
    return hours >= 0 && hours < 12
  }, [currentTime])

  const safeCap = Math.max(1, energyCap)
  const energyPercent = Math.min(100, Math.max(0, Math.round((displayEnergy / safeCap) * 100)))

  // Use real-time stats if available, fallback to props
  const resolvedMorale = normalizeMorale(realtimeStats?.morale ?? morale)
  const resolvedMentalPower = Math.round(
    Math.max(0, Math.min(100, (realtimeStats?.power_mental ?? mentalPower) ?? 0)),
  )
  const resolvedStrengthValue = normalizeStrength(
    realtimeStats?.strength ?? strength ?? 0,
    STRENGTH_DISPLAY_PRECISION,
  )
  const resolvedStrengthDisplay = resolvedStrengthValue.toFixed(STRENGTH_DISPLAY_PRECISION)
  const moraleBarValue = resolvedMorale * 2 - 100
  const moraleColor = getMoraleColor(moraleBarValue)
  const rankLabel = currentMilitaryRank?.trim() || "Recruit"

  const separatorClass = "h-6 w-px bg-border shrink-0"
  const progressBarOuterClass = "h-1.5 w-full rounded-full bg-muted overflow-hidden"
  const progressBarInnerClass = "h-full rounded-full transition-all duration-300 ease-out"
  const messageBadgeClass =
    "absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-[9px] font-semibold leading-none tracking-tight text-white pointer-events-none shadow-lg"

  const statsRowRef = React.useRef<HTMLDivElement>(null)
  const rightControlsRef = React.useRef<HTMLDivElement>(null)
  const [showRank, setShowRank] = React.useState(true)
  const [leftLayoutStage, setLeftLayoutStage] =
    React.useState<RightLayoutStage>("default")
  const [rightLayoutStage, setRightLayoutStage] =
    React.useState<RightLayoutStage>("default")

  // Memoize callbacks to prevent re-renders
  const memoizedHandleTravelSuccess = React.useCallback((hexId: string, locationName: string) => {
    setUserCurrentHex(hexId)
    setUserCurrentLocationName(locationName)
    setTravelStatus("success")
    setTimeout(() => setTravelStatus("idle"), 2000)
  }, [])

  const memoizedHandleTravelStatusChange = React.useCallback((status: "idle" | "loading" | "success" | "error", error?: string) => {
    setTravelStatus(status)
    if (error) setTravelError(error)
  }, [])

  const showButtonText = rightLayoutStage === "default"
  const healthActionGapClass = rightLayoutStage === "compact" ? "gap-2" : "gap-3"
  const iconActionGapClass = rightLayoutStage === "compact" ? "gap-1" : "gap-2"

  const iconButtonClass =
    "h-8 w-8 rounded-lg border border-border/40 bg-transparent p-0 text-foreground transition-colors hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0"

  const actionButtonBase =
    "flex h-8 min-w-[88px] flex-shrink-0 items-center justify-center gap-1 rounded-lg px-3 text-[11px] font-semibold transition-all"
  const drawerShellClass = cn(
    "relative w-11/12 transition-all duration-300 ease-out",
    isOpen
      ? "h-12 opacity-100 visible translate-y-0 overflow-visible"
      : "h-0 opacity-0 invisible -translate-y-6 pointer-events-none overflow-hidden",
  )

  React.useLayoutEffect(() => {
    if (!statsRowRef.current) return
    const update = () => {
      const width = statsRowRef.current?.clientWidth ?? 0
      setShowRank(width > 360)
      const nextStage: RightLayoutStage =
        width < 360 ? "mini" : width < 460 ? "compact" : "default"
      setLeftLayoutStage((prev) => (prev === nextStage ? prev : nextStage))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(statsRowRef.current)
    return () => observer.disconnect()
  }, [])

  React.useLayoutEffect(() => {
    if (!rightControlsRef.current) return
    const update = () => {
      const width = rightControlsRef.current?.clientWidth ?? 0
      const nextStage: RightLayoutStage =
        width < 360 ? "mini" : width < 460 ? "compact" : "default"
      setRightLayoutStage((prev) => (prev === nextStage ? prev : nextStage))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(rightControlsRef.current)
    return () => observer.disconnect()
  }, [])

  const handleTrain = async () => {
    if (!canTrain || isTraining) return

    setIsTraining(true)
    try {
      const result = await trainAction()
      if (result.error) {
        console.error('Training failed:', result.error)
        showInfoToast(result.error)
      } else {
        setCanTrain(false)
        if (result.levelUp && result.newLevel) {
          showLevelUpToast({
            level: result.newLevel,
            levelUps: 1,
          })
        }
      }
    } catch (error) {
      console.error('Training error:', error)
      showErrorToast("Something went wrong while training. Try again shortly.")
    } finally {
      setIsTraining(false)
    }
  }

  const handleEat = async () => {
    if (isEating || foodCount === 0) return

    setIsEating(true)
    try {
      const response = await fetch("/api/users/eat-food", {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        showErrorToast(error.error || "Failed to eat food")
        return
      }

      const result = await response.json()

      console.log("[STATS-DRAWER] Eat food result:", result)

      // Update energy in local state
      if (result.energy !== undefined) {
        setDisplayEnergy(result.energy)
        // Update global energy context
        if (vitalsContext?.setEnergy) {
          vitalsContext.setEnergy(result.energy)
        }
      }

      // Refresh food inventory count in vitals context (single source of truth)
      try {
        const inventoryResponse = await fetch("/api/inventory?type=food")
        if (inventoryResponse.ok) {
          const data = await inventoryResponse.json()
          console.log("[STATS-DRAWER] Refreshed food count:", data.quantity)
          if (vitalsContext?.setFoodCount) {
            vitalsContext.setFoodCount(data.quantity || 0)
          }
        }
      } catch (err) {
        console.error("[STATS-DRAWER] Error refreshing food count:", err)
      }

      // Refresh user stats to update morale immediately
      console.log("[STATS-DRAWER] Refetching stats...")
      if (refetchStats) {
        await refetchStats()
        console.log("[STATS-DRAWER] Stats refetched")
      }

      // Show success toast with energy gained
      const qualityNames = ["", "Common", "Uncommon", "Rare", "Epic", "Legendary"]
      const qualityName = qualityNames[result.foodQuality] || "Food"
      showInfoToast(`Ate ${qualityName} food! +${result.energyGained} energy, +${result.moraleBoost} morale`)
    } catch (error) {
      console.error('[STATS-DRAWER] Error eating food:', error)
      showErrorToast("Something went wrong. Try again shortly.")
    } finally {
      setIsEating(false)
    }
  }


  return (
    <>
      {/* Desktop/Tablet View */}
      <div className="hidden sm:flex justify-center">
        <div className={drawerShellClass}>
          <div className="relative">
            <div className="bg-background border-l border-r border-b border-border rounded-b-2xl h-12">
              {/* Content Area */}
              <div className="relative flex flex-1 items-center px-3 md:px-6 lg:px-8 py-2">
                <div className="mx-auto w-full max-w-6xl">
                  {/* Split the drawer into left stats and right controls so they stay centered around the avatar */}
                  <div className="flex w-full items-center gap-12">
                    <div className="flex-1 min-w-0 flex justify-end pr-2 md:pr-4 lg:pr-6">
                      <div className="w-full max-w-full">
                        <div className="flex flex-col gap-1">
                          <QuickStatsRow
                            showRank={showRank}
                            rowRef={statsRowRef}
                            showMorale={leftLayoutStage !== "mini"}
                            moraleValue={resolvedMorale}
                            moraleColor={moraleColor}
                            isDay={isDay}
                            formattedTime={formattedTime}
                            unreadMessagesCount={unreadMessagesCount}
                            userCurrentLocationName={userCurrentLocationName}
                            userCurrentHex={userCurrentHex}
                            userTicketCount={userTicketCount}
                            onTravelSuccess={memoizedHandleTravelSuccess}
                            onTravelStatusChange={memoizedHandleTravelStatusChange}
                            iconButtonClass={iconButtonClass}
                            messageBadgeClass={messageBadgeClass}
                            separatorClass={separatorClass}
                            progressBarOuterClass={progressBarOuterClass}
                            progressBarInnerClass={progressBarInnerClass}
                          />
                          {children && (
                            <div className="text-muted-foreground text-sm font-nav">
                              {children}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Health Bar, Action Buttons, Wallet */}
                    <div className="flex-1 min-w-0 flex justify-start pl-2 md:pl-4 lg:pl-6">
                      <div
                        className={cn(
                          "flex w-full items-center justify-end flex-nowrap",
                          healthActionGapClass,
                        )}
                        ref={rightControlsRef}
                      >
                        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                          {rightLayoutStage !== "mini" && (
                            <>
                              <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex items-center justify-between text-[11px] font-semibold font-mono text-foreground">
                                  <div className="flex items-center gap-1">
                                    <Heart className="h-3 w-3 text-green-500 fill-green-500" />
                                    <span className="text-green-500">{displayEnergy}</span>
                                  </div>
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Plus className="h-3 w-3" />
                                    <span className="text-[11px] font-semibold tracking-wide">
                                      {energyPerHour}/hr
                                    </span>
                                  </span>
                                </div>
                                <div className={progressBarOuterClass}>
                                  <div
                                    className={`${progressBarInnerClass} bg-green-500`}
                                    style={{ width: `${energyPercent}%` }}
                                  />
                                </div>
                              </div>
                              <div className={separatorClass} aria-hidden />
                            </>
                          )}
                          <div className={cn("flex items-center whitespace-nowrap flex-shrink-0", iconActionGapClass)}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleTrain}
                              disabled={!canTrain || isTraining}
                              className={cn(
                                `${actionButtonBase} border border-border/40`,
                                canTrain && !isTraining
                                  ? "bg-gradient-to-br from-green-700 via-green-800 to-green-900 text-white hover:from-green-600 hover:via-green-700 hover:to-green-800"
                                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                              )}
                              style={{
                                backgroundImage: canTrain && !isTraining
                                  ? `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h20v20H0z' fill='%23556b2f'/%3E%3Cpath d='M20 0h20v20H20z' fill='%234a5f1f'/%3E%3Cpath d='M0 20h20v20H0z' fill='%234a5f1f'/%3E%3Cpath d='M20 20h20v20H20z' fill='%233d4f1a'/%3E%3Ccircle cx='10' cy='30' r='8' fill='%23667c3a'/%3E%3Ccircle cx='30' cy='10' r='6' fill='%23526b2a'/%3E%3C/svg%3E")`
                                  : undefined,
                                backgroundSize: '20px 20px',
                              }}
                            >
                              {isTraining ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Dumbbell className="h-3.5 w-3.5" />
                              )}
                              <span className={showButtonText ? "inline" : "sr-only"}>
                                Train
                              </span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleEat}
                              disabled={foodCount === 0 || isEating}
                              className={cn(
                                actionButtonBase,
                                foodCount > 0 && !isEating
                                  ? "border-2 border-amber-500/60 bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white hover:from-amber-500 hover:via-orange-500 hover:to-amber-600"
                                  : "border border-border/40 bg-muted/80 text-muted-foreground cursor-not-allowed"
                              )}
                            >
                              {isEating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <span className="text-sm">🍞</span>
                              )}
                              <span className={showButtonText ? "inline" : "sr-only"}>
                                Eat {foodCount > 0 && `(${foodCount})`}
                              </span>
                            </Button>
                          </div>
                          <div className={separatorClass} aria-hidden />
                          <div className="flex items-center gap-2 flex-shrink-0 flex-nowrap">
                            <div className="flex items-center gap-1 text-sm font-bold font-mono">
                              <GoldCoinIcon className="h-3.5 w-3.5" />
                              <span className="text-sm font-bold font-mono text-foreground">
                                {wallet?.goldCoins.toFixed(0) ?? '0'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-sm font-bold font-mono">
                              <CommunityCoinIcon
                                className="h-3.5 w-3.5"
                                color={wallet?.communityWallets[0]?.communityColor || undefined}
                              />
                              <span className="text-sm font-bold font-mono text-foreground">
                                {wallet?.communityWallets[0]?.amount.toFixed(0) ?? '0'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Avatar Circle - positioned at center, relative to drawer shell */}
            <Link href="/profile" aria-hidden={!isOpen}>
              <div
                className={cn(
                  "absolute left-1/2 top-0 transition-all duration-300 ease-out",
                  isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
                )}
                style={{
                  transform: "translateX(calc(-50% + 1.8px))",
                  zIndex: 20,
                }}
              >
                <div className="relative flex items-center justify-center"
                  style={{
                    width: 'calc(1rem + 2.75rem)',
                    height: 'calc(1rem + 2.75rem)',
                  }}
                >
                  {/* Seamless outer ring - blends with drawer border */}
                  <div className="absolute inset-0 rounded-full border border-border bg-background"
                    style={{
                      clipPath: 'polygon(0 78.3%, 100% 78.3%, 100% 100%, 0 100%)',
                    }}
                  />
                  {/* Avatar */}
                  <Avatar className="relative h-12 w-12 flex-shrink-0">
                    <AvatarImage src={userAvatar} alt={userName} />
                    <AvatarFallback className="text-xs font-semibold bg-muted">
                      {userName?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile View - Drawer slides from bottom */}
      {isOpen && (
        <div
          className={cn(
            "sm:hidden fixed inset-x-0 bottom-0 z-40 bg-background border-t border-border",
            "max-h-[60vh] animate-in slide-in-from-bottom-4 duration-300"
          )}
        >
          {/* Mobile Header with drag handle */}
          <div className="sticky top-0 bg-background px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex-1 flex justify-center">
              <div className="h-1 w-12 rounded-full bg-muted" />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onTogglePin}
                className="h-8 w-8 rounded-md hover:bg-muted/80"
                title={isPinned ? "Unpin drawer" : "Pin drawer"}
              >
                {isPinned ? (
                  <Pin className="h-4 w-4 fill-current" />
                ) : (
                  <PinOff className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-8 w-8 rounded-md hover:bg-muted/80"
                title="Close drawer"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="overflow-y-auto max-h-[calc(60vh-3.5rem)]">
            <div className="px-4 py-4 space-y-4">
              <div className="space-y-3 pb-4 border-b border-border">
                <QuickStatsRow
                  className="w-full"
                  showRank={showRank}
                  showMorale={false}
                  moraleValue={resolvedMorale}
                  moraleColor={moraleColor}
                  hideLeftActions
                  isDay={isDay}
                  formattedTime={formattedTime}
                  unreadMessagesCount={unreadMessagesCount}
                  userCurrentLocationName={userCurrentLocationName}
                  userCurrentHex={userCurrentHex}
                  userTicketCount={userTicketCount}
                  onTravelSuccess={memoizedHandleTravelSuccess}
                  onTravelStatusChange={memoizedHandleTravelStatusChange}
                  iconButtonClass={iconButtonClass}
                  messageBadgeClass={messageBadgeClass}
                  separatorClass={separatorClass}
                  progressBarOuterClass={progressBarOuterClass}
                  progressBarInnerClass={progressBarInnerClass}
                />
                {/* Top Row: Energy Bar */}
                <div className="flex items-center gap-3">
                  {/* Energy Bar - Next to Avatar */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-foreground font-mono">
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3 text-green-500 fill-green-500" />
                        <span className="text-green-500">{displayEnergy}</span>
                      </div>
                      <span className="text-muted-foreground">+{energyPerHour}/hr</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all duration-300 ease-out"
                        style={{ width: `${energyPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Action Buttons, Messages, Time */}
                <div className="flex items-center justify-between gap-3">
                  {/* Action Buttons - Wider with Better Spacing */}
                  <div className="flex items-center gap-2 flex-1">
                    {/* Eat Button - Food with Quality */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEat}
                      disabled={foodCount === 0 || isEating}
                      className={cn(
                        "h-8 flex-1 text-xs font-bold relative overflow-hidden",
                        foodCount > 0 && !isEating
                          ? "border-2 border-amber-500/60 bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white hover:from-amber-500 hover:via-orange-500 hover:to-amber-600"
                          : "bg-muted/80 text-muted-foreground cursor-not-allowed"
                      )}
                    >
                      {isEating ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden />
                      ) : (
                        <span className="text-sm mr-1">🍞</span>
                      )}
                      {isEating ? 'Eating...' : `Eat${foodCount > 0 ? ` (${foodCount})` : ''}`}
                    </Button>

                    {/* Train Button with Camo Pattern */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleTrain}
                      disabled={!canTrain || isTraining}
                      className={cn(
                        "h-8 flex-1 text-xs font-bold relative overflow-hidden",
                        canTrain && !isTraining
                          ? "bg-gradient-to-br from-green-700 via-green-800 to-green-900 text-white hover:from-green-600 hover:via-green-700 hover:to-green-800"
                          : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                      )}
                      style={{
                        backgroundImage: canTrain && !isTraining
                          ? `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h20v20H0z' fill='%23556b2f'/%3E%3Cpath d='M20 0h20v20H20z' fill='%234a5f1f'/%3E%3Cpath d='M0 20h20v20H0z' fill='%234a5f1f'/%3E%3Cpath d='M20 20h20v20H20z' fill='%233d4f1a'/%3E%3Ccircle cx='10' cy='30' r='8' fill='%23667c3a'/%3E%3Ccircle cx='30' cy='10' r='6' fill='%23526b2a'/%3E%3C/svg%3E")`
                          : undefined,
                        backgroundSize: '20px 20px',
                      }}
                    >
                      <Dumbbell className="h-3.5 w-3.5 mr-1.5" />
                      {isTraining ? 'Training...' : 'Train'}
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Messages Icon */}
                    <Link href="/messages" className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-md hover:bg-muted/80"
                      >
                        <Mail className="h-5 w-5" />
                        {unreadMessagesCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                          </span>
                        )}
                      </Button>
                    </Link>

                    {/* Server Time */}
                    <div className="flex items-center gap-2">
                      {isDay ? (
                        <Sun className="h-5 w-5 text-amber-500" />
                      ) : (
                        <Moon className="h-5 w-5 text-blue-400" />
                      )}
                      <p className="text-xl font-bold font-mono text-foreground">{formattedTime}</p>
                    </div>

                    {/* Separator */}
                    <div className="h-8 w-px bg-border" />

                    {/* Wallet Coins */}
                    <div className="flex items-center gap-2">
                      {/* Gold Coin */}
                      <div className="flex items-center gap-1">
                        <GoldCoinIcon className="h-4 w-4" />
                        <span className="text-base font-bold font-mono text-foreground">
                          {wallet?.goldCoins.toFixed(0) ?? '0'}
                        </span>
                      </div>
                      {/* Community Currency Coin */}
                      <div className="flex items-center gap-1">
                        <CommunityCoinIcon
                          className="h-4 w-4"
                          color={wallet?.communityWallets[0]?.communityColor || undefined}
                        />
                        <span className="text-base font-bold font-mono text-foreground">
                          {wallet?.communityWallets[0]?.amount.toFixed(0) ?? '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {children || (
                <div className="text-muted-foreground text-sm font-nav">
                  Stats drawer content goes here
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile overlay when drawer is open */}
      {isOpen && (
        <div
          className="sm:hidden fixed inset-0 top-16 z-30 bg-black/20 animate-in fade-in duration-200"
          onClick={onToggle}
        />
      )}
    </>
  )
}
