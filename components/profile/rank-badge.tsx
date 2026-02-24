'use client';

import Image from 'next/image';
import { type MilitaryRank } from '@/lib/military-ranks';
import { cn } from '@/lib/utils';

interface RankBadgeProps {
  rank: MilitaryRank;
  rankNumber: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  className?: string;
  fallbackIcon?: string;
}

const sizeConfig = {
  sm: {
    container: 'w-12 h-12',
    icon: 40,
    border: 'border-[2px]',
    shadow: 'shadow-sm',
    labelText: 'text-[10px]',
  },
  md: {
    container: 'w-16 h-16',
    icon: 57,
    border: 'border-[3px]',
    shadow: 'shadow-md',
    labelText: 'text-xs',
  },
  lg: {
    container: 'w-24 h-24',
    icon: 86,
    border: 'border-[4px]',
    shadow: 'shadow-lg',
    labelText: 'text-sm',
  },
  xl: {
    container: 'w-32 h-32',
    icon: 114,
    border: 'border-[5px]',
    shadow: 'shadow-xl',
    labelText: 'text-base',
  },
};

export function RankBadge({
  rank,
  rankNumber,
  size = 'md',
  showLabel = false,
  className,
  fallbackIcon = '🪖',
}: RankBadgeProps) {
  const config = sizeConfig[size];
  const imagePath = `/images/ranks/${rankNumber}.png`;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div
        className={cn(
          'relative flex items-center justify-center rounded-xl overflow-hidden',
          config.container,
          config.border,
          config.shadow,
          // 3D border styling
          'border-amber-600/80',
          'shadow-[0_4px_0_0_rgba(120,53,15,0.6),0_8px_12px_0_rgba(0,0,0,0.3)]',
          // Hover effect
          'transition-transform hover:scale-105 hover:-translate-y-0.5',
          'cursor-pointer'
        )}
      >
        {/* Blurred dark camouflage background layer */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/images/ranks/ranktexture.jpg)',
            filter: 'blur(0px) brightness(0.85)',
          }}
        />

        {/* Glass overlay */}
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" />

        {/* Dark inset shadow for depth */}
        <div className="absolute inset-0 rounded-lg shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] pointer-events-none" />
        {/* Golden gradient overlay for rank icon */}
        <div className="relative z-10 flex items-center justify-center">
          <Image
            src={imagePath}
            alt={`${rank} badge`}
            width={config.icon}
            height={config.icon}
            className={cn(
              'object-contain',
              // Convert black to gold - proven filter combination
              'drop-shadow-[0_3px_6px_rgba(218,165,32,0.6)]'
            )}
            style={{
              filter: 'brightness(0) saturate(100%) invert(64%) sepia(89%) saturate(1395%) hue-rotate(1deg) brightness(101%) contrast(101%)',
            }}
            onError={(e) => {
              // Fallback to emoji if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="text-4xl">${fallbackIcon}</span>`;
              }
            }}
          />
        </div>

        {/* Subtle shine effect */}
        <div
          className={cn(
            'absolute inset-0 rounded-lg pointer-events-none',
            'bg-gradient-to-br from-white/20 via-transparent to-transparent',
            'opacity-40'
          )}
        />
      </div>

      {showLabel && (
        <div className="flex flex-col items-center gap-0.5">
          <span
            className={cn(
              'font-semibold text-amber-700 dark:text-amber-400',
              config.labelText
            )}
          >
            {rank}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Rank {rankNumber}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline rank badge (for tables, lists, etc.)
 */
export function RankBadgeInline({
  rank,
  rankNumber,
  fallbackIcon = '🪖',
  showRankNumber = false,
  showLabel = true,
  labelPosition = 'right',
  labelClassName,
}: {
  rank: MilitaryRank;
  rankNumber: number;
  fallbackIcon?: string;
  showRankNumber?: boolean;
  showLabel?: boolean;
  labelPosition?: 'left' | 'right';
  labelClassName?: string;
}) {
  const imagePath = `/images/ranks/${rankNumber}.png`;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2',
        labelPosition === 'left' ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <div
        className={cn(
          'relative flex items-center justify-center rounded-md overflow-hidden',
          'w-10 h-10',
          'border-[2px] border-amber-600/80',
          'shadow-[0_2px_0_0_rgba(120,53,15,0.6)]'
        )}
      >
        {/* Blurred dark camouflage background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/images/ranks/ranktexture.jpg)',
            filter: 'blur(1.5px) brightness(0.4)',
          }}
        />

        {/* Glass overlay */}
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

        <Image
          src={imagePath}
          alt={rank}
          width={29}
          height={29}
          className={cn(
            'object-contain relative z-10',
            'drop-shadow-[0_2px_3px_rgba(218,165,32,0.5)]'
          )}
          style={{
            filter: 'brightness(0) saturate(100%) invert(64%) sepia(89%) saturate(1395%) hue-rotate(1deg) brightness(101%) contrast(101%)',
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `<span class="text-sm">${fallbackIcon}</span>`;
            }
          }}
        />
      </div>
      {showLabel && (
        <span className={cn("text-sm font-medium", labelClassName)}>
          {rank}
          {showRankNumber && (
            <span className="text-xs text-muted-foreground ml-1">
              (Rank {rankNumber})
            </span>
          )}
        </span>
      )}
    </div>
  );
}
