"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  isLoading: boolean;
}

export function PageLoader({ isLoading }: PageLoaderProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-gradient-to-b from-background/50 to-background/80 backdrop-blur-sm flex items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 150 }}
            className="flex flex-col items-center gap-4"
          >
            {/* Game-like Loading Animation */}
            <div className="relative w-16 h-16">
              {/* Outer rotating ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />

              {/* Middle rotating ring - opposite direction */}
              <motion.div
                className="absolute inset-1 rounded-full border-2 border-transparent border-b-accent border-l-accent"
                animate={{ rotate: -360 }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />

              {/* Inner icon */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatType: "reverse" as const,
                }}
              >
                <Loader2 className="w-6 h-6 text-primary" />
              </motion.div>
            </div>

            {/* Loading Text with pulsing dots */}
            <motion.div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-foreground font-nav">
                Loading
              </span>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1.4,
                    delay: i * 0.2,
                    repeat: Infinity,
                  }}
                  className="text-sm font-semibold text-primary"
                >
                  •
                </motion.span>
              ))}
            </motion.div>

            {/* Progress bar effect */}
            <div className="w-32 h-1 bg-muted/30 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                initial={{ width: 0 }}
                animate={{ width: ["0%", "70%", "100%"] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "loop" as const,
                  ease: "easeInOut",
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
