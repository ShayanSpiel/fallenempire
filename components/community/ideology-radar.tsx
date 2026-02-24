'use client'

/**
 * Ideology Radar Chart Component
 *
 * Displays 5-axis radar/spider chart visualization of ideology vector
 */

import { useMemo } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { IDEOLOGY_CONFIG } from '@/lib/ideology-config'
import { IdentityVector } from '@/lib/ideology'

interface IdeologyRadarProps {
  ideology: IdentityVector
  showLabels?: boolean
  height?: number
  interactive?: boolean
  variant?: 'default' | 'compact'
}

export function IdeologyRadar({
  ideology,
  showLabels = true,
  height = 400,
  interactive = true,
  variant = 'default',
}: IdeologyRadarProps) {
  // Transform ideology vector to chart data
  const data = useMemo(() => {
    return IDEOLOGY_CONFIG.axes.map(axis => ({
      name: variant === 'compact' ? axis.label.split(' vs ')[0] : axis.label,
      value: Math.round(((ideology[axis.key as keyof IdentityVector] || 0) + 1) * 50), // Scale 0-100
      full: ideology[axis.key as keyof IdentityVector] || 0,
    }))
  }, [ideology, variant])

  const chartHeight = variant === 'compact' ? 250 : Math.max(200, height)
  const containerStyle = {
    width: "100%",
    height: chartHeight,
    minHeight: chartHeight,
    minWidth: 0,
  }

  return (
    <div className="w-full flex flex-col items-center" style={containerStyle}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <RadarChart data={data} margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
          <PolarGrid stroke="var(--border)" strokeOpacity={0.3} />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: 'var(--muted-foreground)', fontSize: variant === 'compact' ? 10 : 11, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Ideology"
            dataKey="value"
            stroke="var(--foreground)"
            strokeWidth={variant === 'compact' ? 2 : 3}
            fill="var(--foreground)"
            fillOpacity={0.1}
          />
          {interactive && (
            <Tooltip
              formatter={(value) => {
                const numericValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0
                return `${numericValue.toFixed(0)}%`
              }}
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--foreground)',
              }}
              labelStyle={{ color: 'var(--foreground)' }}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
