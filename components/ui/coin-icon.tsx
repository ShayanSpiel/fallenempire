import { useId } from "react";
import { CURRENCY_COLORS } from "@/lib/design-system";

interface CoinIconProps {
  className?: string;
}

export function GoldCoinIcon({ className }: CoinIconProps) {
  const id = useId().replace(/:/g, "");
  const gradientId = `goldGradient-${id}`;
  const shineId = `goldShine-${id}`;

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill={`url(#${gradientId})`} />
      <circle cx="12" cy="12" r="8" fill={`url(#${shineId})`} opacity="0.3" />
      <circle cx="9" cy="9" r="2" fill="white" opacity="0.4" />
      <defs>
        <radialGradient id={gradientId} cx="0.3" cy="0.3" r="1">
          <stop offset="0%" stopColor={CURRENCY_COLORS.gold} />
          <stop offset="50%" stopColor={CURRENCY_COLORS.goldDark} />
          <stop offset="100%" stopColor={CURRENCY_COLORS.goldDarker} />
        </radialGradient>
        <radialGradient id={shineId} cx="0.4" cy="0.4" r="0.8">
          <stop offset="0%" stopColor={CURRENCY_COLORS.goldLight} />
          <stop offset="100%" stopColor={CURRENCY_COLORS.gold} opacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

interface CommunityCoinIconProps extends CoinIconProps {
  /**
   * Optional community color to tint the coin.
   * Can be any valid CSS color (hex, rgb, hsl, etc.)
   */
  color?: string;
}

export function CommunityCoinIcon({ className, color }: CommunityCoinIconProps) {
  const id = useId().replace(/:/g, "");
  const gradientId = `silverGradient-${id}`;
  const shineId = `silverShine-${id}`;
  const colorOverlayId = `colorOverlay-${id}`;

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill={`url(#${gradientId})`} />
      <circle cx="12" cy="12" r="8" fill={`url(#${shineId})`} opacity="0.4" />
      {color && (
        <>
          {/* Color overlay with multiply blend mode for tinting effect */}
          <circle
            cx="12"
            cy="12"
            r="10"
            fill={color}
            opacity="0.55"
            style={{ mixBlendMode: 'multiply' }}
          />
          {/* Additional colored gradient for depth */}
          <circle
            cx="12"
            cy="12"
            r="10"
            fill={`url(#${colorOverlayId})`}
            opacity="0.4"
          />
        </>
      )}
      <circle cx="9" cy="9" r="2" fill="white" opacity="0.5" />
      <defs>
        <radialGradient id={gradientId} cx="0.3" cy="0.3" r="1">
          <stop offset="0%" stopColor="#E8E8E8" />
          <stop offset="50%" stopColor="#C0C0C0" />
          <stop offset="100%" stopColor="#A8A8A8" />
        </radialGradient>
        <radialGradient id={shineId} cx="0.4" cy="0.4" r="0.8">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C0C0C0" opacity="0" />
        </radialGradient>
        {color && (
          <radialGradient id={colorOverlayId} cx="0.3" cy="0.3" r="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </radialGradient>
        )}
      </defs>
    </svg>
  );
}
