"use client";

import { AuthTabs } from "@/components/auth/auth-tabs";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

type LandingCTAProps = {
  shouldForceAuth: boolean;
  defaultTab: "login" | "register";
};

const benefits = [
  "Completely free - no premium barrier",
  "Live multiplayer world with persistent state",
  "AI rivals that actually think & adapt",
  "Wage real wars. Make real politics.",
  "100% skill-based. No pay-to-win.",
];

export function LandingCTA({ shouldForceAuth, defaultTab }: LandingCTAProps) {
  return (
    <section className="border-b border-border px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl">
        {/* Testimonials/Social proof */}
        <div className="mb-16 grid gap-6 sm:grid-cols-2">
          <Card variant="subtle" className="p-6 border-primary/20">
            <p className="mb-4 text-sm italic font-medium text-muted-foreground">
              &ldquo;Most addictive strategy game ever. The AI actually outplayed me.&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">A</div>
              <div>
                <p className="text-sm font-semibold text-foreground">Alex Chen</p>
                <p className="text-xs text-muted-foreground">Power Player</p>
              </div>
            </div>
          </Card>

          <Card variant="subtle" className="p-6 border-secondary/20">
            <p className="mb-4 text-sm italic font-medium text-muted-foreground">
              &ldquo;Politics winning wars. Laws shaping victory. This is next level.&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center text-sm font-bold text-secondary">J</div>
              <div>
                <p className="text-sm font-semibold text-foreground">Jordan M.</p>
                <p className="text-xs text-muted-foreground">Tactician</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main CTA Card */}
        <Card variant="elevated" className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-secondary/5 p-8 text-center sm:p-12">
          <h2 className="text-4xl font-black leading-tight sm:text-5xl">
            Your Empire Awaits.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-muted-foreground">
            Build nations. Shape politics. Wage wars. Compete with brilliant AI. Dominate globally. Play free forever.
          </p>

          {/* Benefits list */}
          <div className="my-8 space-y-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center justify-center gap-3">
                <Check className="h-5 w-5 text-primary" />
                <span className="text-sm text-foreground">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Auth modal trigger */}
          <div className="flex flex-col items-center gap-4">
            <AuthTabs
              defaultOpen={shouldForceAuth}
              defaultTab={defaultTab}
              trigger={null}
              ctaLabel="Create Your Empire Now"
            />
            <p className="text-xs text-muted-foreground">
              ⚡ Instant access. No card needed. Play in 60 seconds.
            </p>
          </div>
        </Card>

        {/* Bottom info */}
        <div className="mt-12 rounded-xl border-2 border-secondary/30 bg-gradient-to-r from-secondary/5 to-primary/5 p-6 text-center backdrop-blur-sm sm:p-8">
          <p className="text-sm font-bold text-foreground">
            🌍 Thousands of players. Real-time battles. Live politics. Historic domination.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Persistent world • Active 24/7 • AI opponents evolve daily
          </p>
        </div>
      </div>
    </section>
  );
}
