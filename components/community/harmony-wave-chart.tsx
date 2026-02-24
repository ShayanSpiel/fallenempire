'use client'

/**
 * Harmony Wave Chart Component
 *
 * Combines a frequency wave visualization with a spectrum bar to show:
 * - Wave pattern: chaos (jagged left) → harmony (smooth middle) → unity (flat right)
 * - Spectrum bar: consensus (aligned) shows position
 * - Colors flow from left (red/divided) to right (green/united)
 *
 * Visual metaphor: Flat line (left) = oppressive unity
 *                  Smooth wave (middle) = healthy diversity
 *                  Chaotic wave (right) = dangerous polarization
 */

import { cn } from '@/lib/utils'
import { BarContainer, BarBackground, BarHandle, BarCenterLine } from '@/components/ui/bar-container'

interface HarmonyWaveChartProps {
  diversity: number // 0-1 scale (perspective variety)
  stability: number // 0-1 scale (how peaceful the diversity is)
  consensus: number // 0-1 scale (alignment on core values) - maps to position on bar
  className?: string
}

/**
 * Get color based on consensus level
 * Red (divided/chaotic) → Yellow (diverse) → Green (united/flat)
 */
function getWaveColor(consensus: number): string {
  const clamped = Math.max(0, Math.min(1, consensus))

  if (clamped < 0.2) return 'rgb(239, 68, 68)' // Red - Divided
  if (clamped < 0.4) return 'rgb(249, 115, 22)' // Orange
  if (clamped < 0.6) return 'rgb(234, 179, 8)' // Yellow - Diverse
  if (clamped < 0.8) return 'rgb(34, 197, 94)' // Green
  return 'rgb(22, 163, 74)' // Dark Green - United
}

/**
 * Get gradient class for spectrum bar
 * Red (divided) → Yellow (diverse) → Green (united)
 */
function getSpectrumGradient(consensus: number): string {
  const clamped = Math.max(0, Math.min(1, consensus))

  if (clamped < 0.2) return 'from-red-500/70 to-orange-500/70'
  if (clamped < 0.4) return 'from-orange-500/70 to-yellow-500/70'
  if (clamped < 0.6) return 'from-yellow-500/70 to-emerald-500/70'
  if (clamped < 0.8) return 'from-emerald-500/70 to-emerald-600/70'
  return 'from-emerald-600/70 to-emerald-700/70'
}

/**
 * Generate SVG path for harmony wave
 * Shows the wave pattern at the current position on the spectrum:
 * - Consensus controls where on spectrum we are
 * - Wave pattern transitions: chaotic (left) → smooth (middle) → flat (right)
 * - Stability controls smoothness/chaos of the wave
 */
function generateWavePath(
  width: number,
  height: number,
  diversity: number,
  stability: number,
  consensus: number
): string {
  let path = `M 0 ${height / 2}`
  const step = 1.5
  const centerY = height / 2

  for (let x = 0; x < width; x += step) {
    let y = centerY
    const normalizedX = x / width // 0 to 1 across full width

    // Get the position on spectrum (0-1)
    const spectrumPosition = consensus // 0=fragmented, 0.5=diverse, 1=united

    // Transition factor: shows which pattern we're at
    let amplitude: number
    let frequency: number

    if (spectrumPosition < 0.2) {
      // FRAGMENTED: Jagged, chaotic waves
      amplitude = 10 * (1 - stability) // High amplitude when unstable
      frequency = 8 // High frequency for jagged effect
      y += Math.sin(normalizedX * frequency * Math.PI) * amplitude
      // Add random jitter for harsh jagged edges
      y += (Math.random() - 0.5) * amplitude * 2.5
    } else if (spectrumPosition < 0.8) {
      // DIVERSE: Smooth, regular waves
      // Amplitude grows with diversity, peaks at 0.5, then decreases
      amplitude = 8 * Math.sin(spectrumPosition * Math.PI) // Peak at 0.5
      frequency = 4 + stability * 1.5 // Higher frequency = smoother
      y += Math.sin(normalizedX * frequency * Math.PI * 2) * amplitude
      // Slight jitter based on instability
      y += (Math.random() - 0.5) * (1 - stability) * amplitude * 0.2
    } else {
      // UNITED: Nearly flat line
      amplitude = (1 - spectrumPosition) * 12 // Approaches 0 as we get closer to 1
      y += Math.sin(normalizedX * Math.PI * 2) * amplitude
    }

    path += ` L ${x} ${y}`
  }

  return path
}

/**
 * Get consensus label based on position
 */
function getConsensusLabel(consensus: number): string {
  if (consensus < 0.2) return 'Fragmented'
  if (consensus < 0.4) return 'Divided'
  if (consensus < 0.6) return 'Diverse'
  if (consensus < 0.8) return 'Aligned'
  return 'United'
}

export function HarmonyWaveChart({
  diversity,
  stability,
  consensus,
  className,
}: HarmonyWaveChartProps) {
  const waveColor = getWaveColor(consensus)
  const spectrumGradient = getSpectrumGradient(consensus)
  const consensusLabel = getConsensusLabel(consensus)

  const chartWidth = 100 // Percentage based
  const waveHeight = 48 // SVG height in pixels
  const consensusPercent = consensus * 100

  const wavePath = generateWavePath(500, waveHeight, diversity, stability, consensus)

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header with labels */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
          Community Harmony
        </label>
        <span className="text-xs font-mono font-bold text-foreground">
          {consensusLabel}
        </span>
      </div>

      {/* Wave + Bar Container - Wave stacked on top, bar below */}
      <div className="space-y-0">
        {/* Wave SVG - full width, no gap */}
        <svg
          width="100%"
          height={waveHeight}
          viewBox="0 0 500 48"
          className="w-full block"
          style={{ display: 'block' }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={waveColor} stopOpacity="0.4" />
              <stop offset="100%" stopColor={waveColor} stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Wave fill */}
          <path
            d={`${wavePath} L 500 ${waveHeight} L 0 ${waveHeight} Z`}
            fill="url(#waveGradient)"
          />

          {/* Wave line */}
          <path
            d={wavePath}
            stroke={waveColor}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Spectrum Bar - Using unified BarContainer */}
        <BarContainer>
          <BarBackground backgroundColor="" className={`bg-gradient-to-r ${spectrumGradient}`}>
            <BarCenterLine />
          </BarBackground>

          {/* Consensus indicator handle */}
          <BarHandle position={consensusPercent} size="md" />
        </BarContainer>
      </div>

      {/* Bottom labels - Single line for both */}
      <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
        <span className="text-left">Fragmented</span>
        <span className="text-center">Harmonious</span>
        <span className="text-right">United</span>
      </div>
    </div>
  )
}
