"use client";

import React, { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { Upload, Loader2 } from "lucide-react";

interface AvatarUploadProps {
  avatarUrl: string | null;
  seed: string;
  fallback: string;
  isOwn: boolean;
  onUploadSuccess?: (avatarUrl: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: { container: "w-12 h-12", overlay: "w-12 h-12", icon: 16 },
  md: { container: "w-20 h-20", overlay: "w-20 h-20", icon: 20 },
  lg: { container: "w-32 h-32", overlay: "w-32 h-32", icon: 32 },
};

export function AvatarUpload({
  avatarUrl,
  seed,
  fallback,
  isOwn,
  onUploadSuccess,
  className,
  size = "md",
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = sizeConfig[size];

  const handleClick = () => {
    if (isOwn && !isLoading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > 500 * 1024) {
      setError(`File too large (${(file.size / 1024).toFixed(2)}KB). Max 500KB.`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await response.json();
      onUploadSuccess?.(data.avatarUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      console.error("Avatar upload error:", err);
    } finally {
      setIsLoading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className={cn("relative group", className)}>
      <div
        className={cn(
          "relative rounded-full overflow-hidden",
          config.container,
          isOwn && "cursor-pointer"
        )}
        onClick={handleClick}
      >
        <Avatar className="w-full h-full rounded-full border-[4px] border-background shadow-lg bg-card">
          <AvatarImage
            src={resolveAvatar({
              avatarUrl,
              seed,
            })}
            className="object-cover w-full h-full"
          />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>

        {/* Upload overlay - only show for own profile */}
        {isOwn && (
          <div
            className={cn(
              config.overlay,
              "absolute top-0 left-0 rounded-full flex items-center justify-center transition-opacity duration-200",
              "bg-black/60 opacity-0 group-hover:opacity-100 pointer-events-none z-10",
              isLoading && "opacity-100"
            )}
          >
            {isLoading ? (
              <Loader2 size={config.icon} className="text-white animate-spin" />
            ) : (
              <Upload size={config.icon} className="text-white" />
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      {isOwn && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isLoading}
        />
      )}

      {/* Error message */}
      {error && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded whitespace-nowrap z-50">
          {error}
        </div>
      )}
    </div>
  );
}
