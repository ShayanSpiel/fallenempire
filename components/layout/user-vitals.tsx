"use client"

import * as React from "react"

import { ENERGY_CAP } from "@/lib/gameplay/constants"

type UserVitalsContextValue = {
  userId: string | null
  energy: number
  setEnergy: (energy: number) => void
  foodCount: number
  setFoodCount: (count: number) => void
}

const UserVitalsContext = React.createContext<UserVitalsContextValue | null>(null)

export function UserVitalsProvider({
  userId,
  initialEnergy,
  children,
}: {
  userId?: string | null
  initialEnergy?: number | null
  children: React.ReactNode
}) {
  const [energy, setEnergyState] = React.useState(() =>
    typeof initialEnergy === "number" ? initialEnergy : ENERGY_CAP
  )
  const [foodCount, setFoodCountState] = React.useState(0)

  React.useEffect(() => {
    if (typeof initialEnergy !== "number") return
    setEnergyState(initialEnergy)
  }, [initialEnergy, userId])

  // Fetch food count on mount and when userId changes
  React.useEffect(() => {
    if (!userId) return

    const fetchFoodCount = async () => {
      try {
        const response = await fetch("/api/inventory?type=food")
        if (response.ok) {
          const data = await response.json()
          setFoodCountState(data.quantity || 0)
        }
      } catch (error) {
        console.error("Error fetching food count:", error)
      }
    }

    fetchFoodCount()
  }, [userId])

  const setEnergy = React.useCallback((nextEnergy: number) => {
    const safeEnergy = Number.isFinite(nextEnergy) ? Math.max(0, Math.round(nextEnergy)) : 0
    setEnergyState(safeEnergy)
  }, [])

  const setFoodCount = React.useCallback((count: number) => {
    const safeCount = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0
    setFoodCountState(safeCount)
  }, [])

  const value = React.useMemo<UserVitalsContextValue>(
    () => ({
      userId: userId ?? null,
      energy,
      setEnergy,
      foodCount,
      setFoodCount,
    }),
    [energy, setEnergy, foodCount, setFoodCount, userId]
  )

  return <UserVitalsContext.Provider value={value}>{children}</UserVitalsContext.Provider>
}

export function useUserVitals() {
  const ctx = React.useContext(UserVitalsContext)
  if (!ctx) {
    throw new Error("useUserVitals must be used within a UserVitalsProvider")
  }
  return ctx
}

export function useOptionalUserVitals() {
  return React.useContext(UserVitalsContext)
}
