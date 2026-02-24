"use client"

import * as React from "react"

import { ENERGY_CAP } from "@/lib/gameplay/constants"

type UserVitalsContextValue = {
  userId: string | null
  energy: number
  setEnergy: (energy: number) => void
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

  React.useEffect(() => {
    if (typeof initialEnergy !== "number") return
    setEnergyState(initialEnergy)
  }, [initialEnergy, userId])

  const setEnergy = React.useCallback((nextEnergy: number) => {
    const safeEnergy = Number.isFinite(nextEnergy) ? Math.max(0, Math.round(nextEnergy)) : 0
    setEnergyState(safeEnergy)
  }, [])

  const value = React.useMemo<UserVitalsContextValue>(
    () => ({
      userId: userId ?? null,
      energy,
      setEnergy,
    }),
    [energy, setEnergy, userId]
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
