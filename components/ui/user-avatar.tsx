import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  username?: string | null;
  avatarUrl?: string | null;
  avatarHair?: string | null;
  avatarEyes?: string | null;
  avatarMouth?: string | null;
  avatarNose?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  // For future cosmetics - frames, effects, etc.
  frame?: string | null;
  frameColor?: string | null;
}

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg",
  xl: "h-16 w-16 text-xl",
};

export function UserAvatar({
  username,
  avatarUrl,
  avatarHair,
  avatarEyes,
  avatarMouth,
  avatarNose,
  size = "md",
  className,
  frame,
  frameColor,
}: UserAvatarProps) {
  const resolvedAvatarUrl = resolveAvatar({
    avatarUrl,
    seed: username,
    avatarHair,
    avatarEyes,
    avatarMouth,
    avatarNose,
  });

  const avatarElement = (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={resolvedAvatarUrl} alt={username || "User avatar"} />
      <AvatarFallback>{username?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
    </Avatar>
  );

  // If frame is provided, wrap avatar with frame styling
  // This can be expanded in the future for different frame types
  if (frame) {
    return (
      <div className="relative">
        {avatarElement}
        {/* Future: Add frame overlay/border based on frame type */}
      </div>
    );
  }

  return avatarElement;
}
