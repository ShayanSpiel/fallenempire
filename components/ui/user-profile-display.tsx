import Link from "next/link";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import { UserNameDisplay } from "./user-name-display";
import { type UserTier } from "./verification-badge";

interface UserProfileDisplayProps {
  username: string | null | undefined;
  userTier?: UserTier | null;
  avatarUrl?: string | null;
  avatarHair?: string | null;
  avatarEyes?: string | null;
  avatarMouth?: string | null;
  avatarNose?: string | null;
  showLink?: boolean;
  avatarSize?: "xs" | "sm" | "md" | "lg" | "xl";
  badgeSize?: "xs" | "sm" | "md" | "lg";
  className?: string;
  nameClassName?: string;
  layout?: "horizontal" | "vertical";
  // For future cosmetics
  frame?: string | null;
  frameColor?: string | null;
}

/**
 * Combined component that displays user avatar + name with verification badge
 * This is the single source of truth for user identity display throughout the app
 */
export function UserProfileDisplay({
  username,
  userTier = "alpha",
  avatarUrl,
  avatarHair,
  avatarEyes,
  avatarMouth,
  avatarNose,
  showLink = true,
  avatarSize = "md",
  badgeSize = "sm",
  className,
  nameClassName,
  layout = "horizontal",
  frame,
  frameColor,
}: UserProfileDisplayProps) {
  const content = (
    <div
      className={cn(
        "flex items-center",
        layout === "horizontal" ? "gap-2" : "flex-col gap-1 items-center",
        className
      )}
    >
      <UserAvatar
        username={username}
        avatarUrl={avatarUrl}
        avatarHair={avatarHair}
        avatarEyes={avatarEyes}
        avatarMouth={avatarMouth}
        avatarNose={avatarNose}
        size={avatarSize}
        frame={frame}
        frameColor={frameColor}
      />
      <UserNameDisplay
        username={username}
        userTier={userTier}
        showLink={false}
        badgeSize={badgeSize}
        className={nameClassName}
      />
    </div>
  );

  if (!showLink || !username) {
    return content;
  }

  return (
    <Link
      href={`/profile/${username}`}
      className="hover:opacity-80 transition-opacity"
    >
      {content}
    </Link>
  );
}
