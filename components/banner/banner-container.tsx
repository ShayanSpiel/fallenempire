"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BannerContainerProps {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  storageKey?: string;
  showToggle?: boolean;
  className?: string;
}

export function BannerContainer({
  children,
  defaultCollapsed = false,
  storageKey = "banner-collapsed",
  showToggle = true,
  className = "",
}: BannerContainerProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMounted, setIsMounted] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined" && storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        setIsCollapsed(stored === "true");
      }
    }
  }, [storageKey]);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (typeof window !== "undefined" && storageKey) {
      localStorage.setItem(storageKey, String(newState));
    }
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted) {
    return null;
  }

  return (
    <div className={`relative w-full ${className}`}>
      <AnimatePresence mode="wait">
        {!isCollapsed ? (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="relative">
              {children}

              {showToggle && (
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleCollapsed}
                    className="h-8 w-8 p-0 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90 shadow-sm"
                    aria-label="Minimize banner"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="collapsed"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 dark:from-amber-500/10 dark:via-yellow-500/10 dark:to-amber-500/10 border-b border-amber-500/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Battle Pass Active
                </span>
              </div>

              {showToggle && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleCollapsed}
                  className="h-8 w-8 p-0 rounded-full hover:bg-amber-500/20"
                  aria-label="Expand banner"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
