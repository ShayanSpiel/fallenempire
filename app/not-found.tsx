"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Home, Search, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
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

  const numberVariants = {
    hidden: { opacity: 0, scale: 0.5, rotate: -180 },
    visible: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        duration: 0.8,
        type: "spring",
        stiffness: 80,
        damping: 10,
      },
    },
    bounce: {
      y: [0, -20, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "loop" as const,
        ease: "easeInOut" as const,
      },
    },
  };

  const swordVariants = {
    hidden: { opacity: 0, x: 0, rotate: 0 },
    visible: {
      opacity: 1,
      x: 0,
      rotate: 0,
      transition: { duration: 0.6 },
    },
    swing: {
      rotate: [0, -20, 0],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        repeatType: "loop" as const,
        ease: "easeInOut" as const,
      },
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 overflow-hidden relative">
      {/* Animated background grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(0deg, transparent 24%, rgba(250, 204, 21, 0.05) 25%, rgba(250, 204, 21, 0.05) 26%, transparent 27%, transparent 74%, rgba(250, 204, 21, 0.05) 75%, rgba(250, 204, 21, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(250, 204, 21, 0.05) 25%, rgba(250, 204, 21, 0.05) 26%, transparent 27%, transparent 74%, rgba(250, 204, 21, 0.05) 75%, rgba(250, 204, 21, 0.05) 76%, transparent 77%, transparent)",
          backgroundSize: "50px 50px",
        }} />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 text-center max-w-2xl"
      >
        {/* 404 Display with Swords */}
        <div className="mb-12 flex items-center justify-center gap-6">
          <motion.div
            variants={swordVariants}
            animate="swing"
            className="origin-bottom"
          >
            <Swords className="w-12 h-12 text-primary" strokeWidth={1.5} />
          </motion.div>

          <motion.div
            variants={numberVariants}
            animate={["visible", "bounce"]}
            className="font-bold text-8xl md:text-9xl text-primary font-nav"
          >
            404
          </motion.div>

          <motion.div
            variants={swordVariants}
            animate="swing"
            className="origin-bottom"
            style={{ scaleX: -1 }}
          >
            <Swords className="w-12 h-12 text-primary" strokeWidth={1.5} />
          </motion.div>
        </div>

        {/* Title */}
        <motion.h1
          variants={itemVariants}
          className="text-3xl md:text-4xl font-bold mb-3 text-foreground font-nav"
        >
          Path Not Found
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={itemVariants}
          className="text-lg text-muted-foreground mb-2"
        >
          The realm you seek doesn't exist in our world.
        </motion.p>

        {/* Description */}
        <motion.p
          variants={itemVariants}
          className="text-sm text-muted-foreground/70 mb-8"
        >
          Perhaps the page has been moved, deleted, or you took a wrong turn. Time to regroup and choose a new path.
        </motion.p>

        {/* Quick Links */}
        <motion.div
          variants={itemVariants}
          className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {[
            { href: "/feed", label: "Feed", icon: Home },
            { href: "/map", label: "Map", icon: Swords },
            { href: "/profile", label: "Profile", icon: Search },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="outline"
                  className="w-full flex items-center gap-2 font-nav hover:bg-primary/10"
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </motion.div>

        {/* Main Action */}
        <motion.div variants={itemVariants}>
          <Link href="/feed">
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-nav font-semibold px-8 py-6 text-base"
              size="lg"
            >
              Return to Base
            </Button>
          </Link>
        </motion.div>

        {/* Decorative Message */}
        <motion.p
          variants={itemVariants}
          className="mt-12 text-xs text-muted-foreground italic"
        >
          "Every great explorer has lost their way. The question is, where will you go next?"
        </motion.p>
      </motion.div>

      {/* Floating elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-primary/30 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              y: -50,
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3 + i,
              delay: i * 0.5,
              repeat: Infinity,
              repeatType: "loop" as const,
            }}
          />
        ))}
      </div>
    </div>
  );
}
