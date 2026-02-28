"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  const iconVariants = {
    hidden: { opacity: 0, rotate: -90 },
    visible: {
      opacity: 1,
      rotate: 0,
      transition: { duration: 0.6, type: "spring", stiffness: 100 },
    },
    pulse: {
      scale: [1, 1.1, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "loop" as const,
      },
    },
  };

  // Particles for visual effect
  const particles = Array.from({ length: 12 }).map((_, i) => ({
    id: i,
    delay: i * 0.05,
    duration: 2 + Math.random() * 1,
  }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 overflow-hidden">
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-1 h-1 bg-primary/40 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              y: -100,
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              repeat: Infinity,
              repeatType: "loop" as const,
            }}
          />
        ))}
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 text-center max-w-md"
      >
        {/* Error Icon */}
        <motion.div variants={iconVariants} animate="pulse" className="mb-8 flex justify-center">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 bg-destructive/10 rounded-full blur-xl" />
            <div className="relative flex items-center justify-center w-24 h-24 bg-destructive/5 rounded-full border-2 border-destructive/30">
              <AlertTriangle className="w-12 h-12 text-destructive" />
            </div>
          </div>
        </motion.div>

        {/* Error Title */}
        <motion.h1
          variants={itemVariants}
          className="text-4xl md:text-5xl font-bold mb-3 text-foreground font-nav"
        >
          Oops! Error
        </motion.h1>

        {/* Error Message */}
        <motion.p
          variants={itemVariants}
          className="text-lg text-muted-foreground mb-4"
        >
          Something went wrong on our end. Our team has been notified.
        </motion.p>

        {/* Error Details */}
        {error?.message && (
          <motion.div
            variants={itemVariants}
            className="mb-6 p-4 bg-muted/30 border border-muted-foreground/20 rounded-lg"
          >
            <p className="text-sm text-muted-foreground font-mono break-words">
              {error.message}
            </p>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex gap-3 flex-col sm:flex-row justify-center"
        >
          <Button
            onClick={reset}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-nav"
            size="lg"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </Button>

          <Link href="/feed" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full flex items-center gap-2 font-nav"
              size="lg"
            >
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </Link>
        </motion.div>

        {/* Help Text */}
        <motion.p
          variants={itemVariants}
          className="mt-8 text-xs text-muted-foreground"
        >
          {error?.digest && (
            <>
              Error ID: <code className="font-mono">{error.digest}</code>
            </>
          )}
        </motion.p>
      </motion.div>
    </div>
  );
}
