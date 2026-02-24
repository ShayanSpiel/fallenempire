"use client";

import { Trophy, Landmark, Scroll, TrendingUp, Shield, Brain } from "lucide-react";
import { AuthTabs } from "@/components/auth/auth-tabs";

const features = [
  {
    icon: Landmark,
    title: "Expand Territory",
    description:
      "Conquer regions. Build strategic bases. Grow from a small nation into a global superpower through warfare and smart expansion.",
    color: "text-primary",
  },
  {
    icon: Scroll,
    title: "Create Laws",
    description:
      "Propose bills. Shape society. Your laws determine how citizens respond and who becomes your natural allies.",
    color: "text-secondary",
  },
  {
    icon: Brain,
    title: "Design Ideology",
    description:
      "Define your nation across 5 axes. Your ideology attracts allies, creates friction with enemies, and shapes citizen morale.",
    color: "text-primary",
  },
  {
    icon: Shield,
    title: "Command Battles",
    description:
      "Turn-based tactical hex combat. Train units. Research tech. Crush enemies with strategy and precision.",
    color: "text-secondary",
  },
  {
    icon: TrendingUp,
    title: "Climb & Unlock",
    description:
      "100-level progression. Earn XP. Collect achievement medals. Unlock special abilities and legendary titles.",
    color: "text-primary",
  },
  {
    icon: Trophy,
    title: "Dominate Socially",
    description:
      "Join nations. Form alliances. Negotiate treaties. Wage wars. Control global destiny through player-driven diplomacy.",
    color: "text-secondary",
  },
];

export function LandingFeatures() {
  return (
    <section className="border-b border-border px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        {/* Section header */}
        <div className="mb-12 text-center sm:mb-16">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">
            Everything You Need to Rule
          </p>
          <h2 className="text-4xl font-black leading-tight sm:text-5xl">
            Master 6 Core <span className="text-secondary">Game Systems</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium text-muted-foreground">
            Wars. Politics. Ideology. Culture. Economy. Diplomacy. Succeed at all of them.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group rounded-lg border border-border bg-card/50 p-6 transition-all duration-300 hover:border-primary/50 hover:bg-card hover:shadow-lg backdrop-blur-sm"
              >
                <div className={`mb-4 inline-flex rounded-lg bg-muted p-3 ${feature.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Visual showcase placeholder */}
        <div className="mt-16 rounded-2xl border-2 border-secondary/30 overflow-hidden shadow-lg">
          <div className="bg-gradient-to-br from-secondary/5 via-primary/5 to-secondary/5 aspect-video flex items-center justify-center backdrop-blur-md p-8">
            <div className="text-center space-y-3">
              <p className="text-sm font-semibold text-foreground">Every system matters.</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Success requires mastery. Build empires. Shape nations. Control the world.
              </p>
            </div>
          </div>
        </div>

        {/* CTA for features section */}
        <div className="mt-12 text-center">
          <p className="mb-6 text-lg font-semibold text-foreground">
            Ready to build your empire?
          </p>
          <AuthTabs
            defaultOpen={false}
            defaultTab="register"
            trigger={null}
            ctaLabel="Start Your Free Game"
          />
        </div>
      </div>
    </section>
  );
}
