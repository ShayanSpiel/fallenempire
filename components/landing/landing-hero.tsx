"use client";

import { AuthTabs } from "@/components/auth/auth-tabs";
import { ArrowRight, Zap, Globe, Users, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

type LandingHeroProps = {
  shouldForceAuth: boolean;
  defaultTab: "login" | "register";
};

export function LandingHero({ shouldForceAuth, defaultTab }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-background via-background to-muted/5 px-4 py-20 sm:py-32 lg:py-40">
      {/* Decorative background elements */}
      <div className="absolute inset-0 -z-10 opacity-20">
        <div className="absolute left-20 top-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl"></div>
        <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-secondary/20 blur-3xl"></div>
      </div>

      <div className="mx-auto max-w-6xl">
        {/* Eyebrow - Updated */}
        <div className="mb-6 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 backdrop-blur-sm">
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              The World's First AI RPG Simulation
            </span>
          </div>
        </div>

        {/* Main headline - Punchy & Exciting */}
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-black leading-tight tracking-tighter sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
              Build Your Empire.
            </span>
            <br />
            <span className="text-foreground">Compete With AI.</span>
            <br />
            <span className="text-secondary">Dominate History.</span>
          </h1>
        </div>

        {/* Subheading - Focus on Features & Excitement */}
        <p className="mx-auto mb-12 max-w-2xl text-center text-lg font-medium text-muted-foreground sm:text-xl leading-relaxed">
          Wage wars on a hexagonal world. Shape politics through laws. Build ideology. Train AI opponents that actually think. Join millions competing for global dominance in the most ambitious strategy game ever created.
        </p>

        {/* Feature highlights - Quick wins */}
        <div className="mb-12 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center backdrop-blur-sm hover:border-primary/40 transition-all">
            <Globe className="mx-auto mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-bold text-foreground">Real-Time Battles</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tactical hex combat with live opponents
            </p>
          </div>
          <div className="rounded-lg border border-secondary/20 bg-secondary/5 p-4 text-center backdrop-blur-sm hover:border-secondary/40 transition-all">
            <Users className="mx-auto mb-2 h-5 w-5 text-secondary" />
            <p className="text-sm font-bold text-foreground">Smart AI Rivals</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Agents that learn, adapt & evolve
            </p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center backdrop-blur-sm hover:border-primary/40 transition-all">
            <Zap className="mx-auto mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-bold text-foreground">Rule Everything</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Laws, ideology, power, morale & more
            </p>
          </div>
        </div>

        {/* CTA Section - Primary */}
        <div className="mb-12 flex flex-col items-center gap-4 sm:gap-6">
          <AuthTabs
            defaultOpen={shouldForceAuth}
            defaultTab={defaultTab}
            trigger={
              <button className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground font-bold text-lg hover:shadow-2xl transition-all duration-300 shadow-lg hover:-translate-y-1 active:translate-y-0">
                <Crown className="h-5 w-5 group-hover:scale-110 transition-transform" />
                Play Now for Free
              </button>
            }
            ctaLabel="Create Your Empire"
          />
          <p className="text-xs text-muted-foreground animate-pulse">
            ✨ Instant access. No credit card. Start commanding in seconds.
          </p>
        </div>

        {/* Screenshot/Video placeholder - Enhanced */}
        <div className="relative mt-16 rounded-2xl border-2 border-primary/30 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-br from-primary/10 via-secondary/10 to-primary/10 aspect-video flex flex-col items-center justify-center backdrop-blur-md p-12">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20">
                <Globe className="h-8 w-8 text-primary animate-bounce" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Experience the Full World</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Command nations. Forge alliances. Wage wars. Elect leaders. Create laws. Every action reshapes reality.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
