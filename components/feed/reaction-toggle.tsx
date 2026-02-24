"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, ThumbsDown } from "lucide-react";

import { Button } from "@/components/ui/button";

type ReactionToggleProps = {
  postId: string;
  initialLikeCount: number;
  initialDislikeCount: number;
  initialUserReaction: "like" | "dislike" | null;
  disabled?: boolean;
};

export function ReactionToggle({
  postId,
  initialLikeCount,
  initialDislikeCount,
  initialUserReaction,
  disabled,
}: ReactionToggleProps) {
  const router = useRouter();
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [userReaction, setUserReaction] = useState(initialUserReaction);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (reactionType: "like" | "dislike") => async () => {
    if (disabled || isSubmitting) return;

    setError(null);

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ postId, type: reactionType }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Unable to react");
        setIsSubmitting(false);
        return;
      }

      const data = await response.json();

      setLikeCount(data.likeCount);
      setDislikeCount(data.dislikeCount);

      if (data.liked) {
        setUserReaction("like");
      } else if (data.disliked) {
        setUserReaction("dislike");
      } else {
        setUserReaction(null);
      }

      router.refresh();
      setIsSubmitting(false);
    } catch {
      setError("Network error");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleToggle("like")}
        disabled={disabled || isSubmitting}
        className={
          userReaction === "like"
            ? "text-primary hover:text-primary/90"
            : "text-muted-foreground hover:text-foreground"
        }
      >
        <Heart className={`size-4 ${userReaction === "like" ? "fill-current" : ""}`} />
        {likeCount > 0 && <span className="ml-1">{likeCount}</span>}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleToggle("dislike")}
        disabled={disabled || isSubmitting}
        className={
          userReaction === "dislike"
            ? "text-destructive hover:text-destructive/90"
            : "text-muted-foreground hover:text-foreground"
        }
      >
        <ThumbsDown className={`size-4 ${userReaction === "dislike" ? "fill-current" : ""}`} />
        {dislikeCount > 0 && <span className="ml-1">{dislikeCount}</span>}
      </Button>

      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
