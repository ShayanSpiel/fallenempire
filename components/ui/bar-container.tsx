'use client'

/**
 * Unified Bar Container Component
 *
 * Provides consistent styling and layout for all progress/spectrum bars.
 * Ensures perfect vertical centering and consistent sizing across all bar types.
 *
 * Features:
 * - h-10 container with flex centering
 * - h-2 bar background (consistent thickness)
 * - Handles positioned with transform for perfect center alignment
 * - No hardcoded styling - uses design tokens
 */

import { cn } from '@/lib/utils'

interface BarContainerProps {
  children: React.ReactNode
  backgroundColor?: string
  heightClassName?: string
  className?: string
}

/**
 * Bar Container - provides consistent sizing and centering for all bars
 *
 * Container is h-10 with absolute positioned bar (h-2) and handles (w-6 h-6).
 * Centering is achieved through absolute positioning with transform.
 *
 * Usage:
 * <BarContainer>
 *   <BarBackground>...</BarBackground>
 *   <BarHandle position={percent} size="md">...</BarHandle>
 * </BarContainer>
 */
export function BarContainer({
  children,
  backgroundColor,
  heightClassName,
  className,
}: BarContainerProps) {
  return (
    <div
      className={cn(
        'relative',
        heightClassName ?? 'h-8', // Container height: 32px (16px top + 3px bar + 13px bottom)
        className
      )}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      {children}
    </div>
  )
}

/**
 * Bar Background - consistent bar styling with perfect centering
 *
 * Positioned absolutely at top-1/2 and vertically centered with transform.
 * This ensures the bar is always centered in the h-10 container.
 */
export function BarBackground({
  children,
  backgroundColor,
  gradient,
  className,
}: {
  children?: React.ReactNode
  backgroundColor?: string
  gradient?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'absolute left-0 right-0',
        'h-3', // Consistent bar thickness: 12px
        'rounded-full overflow-hidden',
        'top-1/2 -translate-y-1/2', // Perfect vertical centering
        'z-0',
        className
      )}
      style={
        backgroundColor
          ? { backgroundColor }
          : gradient
            ? { backgroundImage: gradient }
            : undefined
      }
    >
      {children}
    </div>
  )
}

/**
 * Bar Handle - consistent handle sizing and perfect centering
 *
 * All handles are w-6 h-6 circles, perfectly centered at the bar's center point.
 * Uses absolute positioning with top: 50% and transform: translate(-50%, -50%)
 * for perfect center alignment both horizontally and vertically.
 */
export function BarHandle({
  children,
  position, // 0-100 percentage
  size = 'md', // sm | md | lg (all render as w-6 h-6)
  className,
  style,
  handleClassName, // For custom handle styling
  zIndex, // Manual z-index override
  ...props
}: {
  children?: React.ReactNode
  position: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
  handleClassName?: string
  zIndex?: number
} & React.HTMLAttributes<HTMLDivElement>) {
  // All handles are the same size: w-6 h-6 (24px)
  const defaultHandleClass = 'bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-300 dark:via-gray-400 dark:to-gray-500 ring-1 ring-gray-400/50 dark:ring-gray-500/50'

  // Size mapping: sm = 20px (10% smaller), md = 24px, lg = 24px
  const sizeClass = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6'

  return (
    <div
      className={cn('absolute transition-all duration-300', sizeClass, className)}
      style={{
        left: `${position}%`,
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: zIndex ?? 10,
        ...style,
      }}
      {...props}
    >
      <div
        className={cn(
          sizeClass,
          'rounded-full shadow-lg flex items-center justify-center flex-shrink-0',
          handleClassName || defaultHandleClass
        )}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Bar Center Line - center reference line
 */
export function BarCenterLine() {
  return (
    <div className="absolute inset-y-0 left-1/2 w-px bg-white/30 transform -translate-x-1/2" />
  )
}
