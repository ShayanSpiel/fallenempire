import Link from "next/link";
import { cn } from "@/lib/utils";
import { VerificationBadge, type UserTier } from "./verification-badge";

interface UserNameDisplayProps {
  username: string | null | undefined;
  userTier?: UserTier | null;
  showLink?: boolean;
  className?: string;
  badgeSize?: "xs" | "sm" | "md" | "lg";
  // For future cosmetics/frames
  frame?: string | null;
  cosmetics?: Record<string, unknown> | null;
}

export function UserNameDisplay({
  username,
  userTier = "alpha",
  showLink = true,
  className,
  badgeSize = "sm",
  frame,
  cosmetics,
}: UserNameDisplayProps) {
  const displayName = username || "Anonymous";
  const tier = userTier || "alpha";

  const content = (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span>{displayName}</span>
      <VerificationBadge tier={tier} size={badgeSize} />
    </span>
  );

  if (!showLink || !username) {
    return content;
  }

  return (
    <Link
      href={`/profile/${username}`}
      className="hover:underline transition-colors"
    >
      {content}
    </Link>
  );
}
