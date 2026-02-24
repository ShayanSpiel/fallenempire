import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { PageSection } from "@/components/layout/page-section";
import { TrainingInterface } from "@/components/training/training-interface";
import { Badge } from "@/components/ui/badge";
import { H1, P } from "@/components/ui/typography";
import { parseStrengthValue } from "@/lib/gameplay/strength";

export const metadata: Metadata = {
  title: "Training",
  description: "Physical conditioning and attribute development.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/train" },
};

// This export default is crucial for Next.js Pages
export default async function TrainingPage() {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=open");

  const { data: profile } = await supabase
    .from("users")
    .select("strength, last_trained_at")
    .eq("auth_id", user.id)
    .single();

  if (!profile) notFound();

  // UTC Day Calculation
  const now = new Date();
  const lastTrained = profile.last_trained_at ? new Date(profile.last_trained_at) : null;
  const isSameDay = lastTrained && 
    lastTrained.getUTCFullYear() === now.getUTCFullYear() &&
    lastTrained.getUTCMonth() === now.getUTCMonth() &&
    lastTrained.getUTCDate() === now.getUTCDate();

  return (
    <PageSection>
      <div className="space-y-8 max-w-5xl mx-auto w-full">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <H1>Physical Conditioning</H1>
            <Badge variant="accent" className="px-3 py-1 text-[10px] uppercase tracking-[0.3em]">
              Daily Cycle
            </Badge>
          </div>
          <P className="text-muted-foreground max-w-2xl">
            Commit resources to improve your base attributes. Training actions are limited by daily recovery cycles.
          </P>
        </div>

        <TrainingInterface
          strength={parseStrengthValue(profile.strength)}
          canTrain={!isSameDay}
        />
      </div>
    </PageSection>
  );
}
