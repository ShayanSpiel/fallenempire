"use client";

import { Card } from "@/components/ui/card";
import { AuthTabs } from "@/components/auth/auth-tabs";

export function LandingGameMechanics() {
  return (
    <section className="border-b border-border px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        {/* Section header */}
        <div className="mb-12 text-center sm:mb-16">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-secondary">
            How It Works
          </p>
          <h2 className="text-4xl font-black leading-tight sm:text-5xl">
            One Game. <span className="text-secondary">Infinite Possibilities.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Master ideology. Pass laws. Train armies. Compete with AI. Rise to global dominance.
          </p>
        </div>

        {/* Mechanics showcase */}
        <div className="space-y-6">
          {/* Row 1: Ideology & Laws */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card variant="elevated" className="p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary font-bold text-sm">
                  01
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  5-Axis Ideology
                </h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Define your nation across 5 dimensions. Your ideology attracts allies and repels enemies. It shapes morale, policies, and your path to dominance.
              </p>
              <div className="space-y-2 text-xs">
                <p className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0"></span>
                  <span>Attract like-minded allies</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0"></span>
                  <span>Create friction with opposites</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0"></span>
                  <span>Control citizen happiness</span>
                </p>
              </div>
            </Card>

            <Card variant="elevated" className="p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/20 text-secondary font-bold text-sm">
                  02
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Legislative Power
                </h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Propose laws. Citizens reward you for alignment, rebel for conflict. Your legislation directly impacts morale, culture, and military power.
              </p>
              <div className="space-y-2 text-xs">
                <p className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-secondary flex-shrink-0"></span>
                  <span>Propose powerful bills</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-secondary flex-shrink-0"></span>
                  <span>Council voting mechanics</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-secondary flex-shrink-0"></span>
                  <span>Change government type</span>
                </p>
              </div>
            </Card>
          </div>

          {/* Row 2: Battles & Progression */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card variant="elevated" className="p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/20 text-secondary font-bold text-sm">
                  03
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Hex Warfare
                </h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Turn-based tactical combat. Deploy units strategically. Research tech. Crush opponents with superior tactics and army composition.
              </p>
              <div className="space-y-2 text-xs">
                <p className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-secondary flex-shrink-0"></span>
                  <span>Tactical hex grid battles</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-secondary flex-shrink-0"></span>
                  <span>Unit training & research</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-secondary flex-shrink-0"></span>
                  <span>Conquer territories</span>
                </p>
              </div>
            </Card>

            <Card variant="elevated" className="p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary font-bold text-sm">
                  04
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Endless Progression
                </h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Level up to 100. Unlock powerful abilities. Earn achievement medals. Build legendary status in the world.
              </p>
              <div className="space-y-2 text-xs">
                <p className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0"></span>
                  <span>100-level growth system</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0"></span>
                  <span>Unlock special abilities</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0"></span>
                  <span>Legendary achievements</span>
                </p>
              </div>
            </Card>
          </div>

          {/* Row 3: Community & Diplomacy */}
          <Card variant="elevated" className="p-6 sm:p-8 lg:col-span-1">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary font-bold text-sm">
                05
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Community Wars
              </h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Join nations. Form alliances. Coordinate massive wars. Negotiate treaties. Control regional politics.
            </p>
            <div className="space-y-2 text-xs">
              <p className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0"></span>
                <span>Player-led alliances</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0"></span>
                <span>Treaty negotiations</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0"></span>
                <span>Shared world events</span>
              </p>
            </div>
          </Card>
        </div>

        {/* AI Rivals Section */}
        <div className="mt-16 rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 p-8 text-center backdrop-blur-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-primary">
            Powered by AI That Actually Thinks
          </p>
          <p className="mt-3 text-2xl font-black text-foreground">
            Your Opponents Learn. Adapt. Evolve.
          </p>
          <p className="mt-3 max-w-2xl mx-auto text-muted-foreground">
            AI leaders aren't scripted. They make strategic decisions, form alliances, wage wars, and grow smarter. Every game is different. Every opponent is unique.
          </p>
        </div>
      </div>
    </section>
  );
}
