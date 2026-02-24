"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { IdeologySelector } from "./ideology-selector";
import { NationSetup } from "./nation-setup";
import { ChevronRight, Zap } from "lucide-react";

interface OnboardingFlowProps {
  onComplete: (data: {
    ideology: {
      order_chaos: number;
      self_community: number;
      logic_emotion: number;
      power_harmony: number;
      tradition_innovation: number;
    };
    nationName: string;
    color: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

type OnboardingStep = "welcome" | "ideology" | "nation" | "loading";

export function OnboardingFlow({ onComplete, isLoading = false }: OnboardingFlowProps) {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [ideology, setIdeology] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleIdeologySubmit = async (ideologyData: any) => {
    setIdeology(ideologyData);
    setStep("nation");
  };

  const handleNationSubmit = async (nationData: any) => {
    setIsSubmitting(true);
    try {
      await onComplete({
        ideology,
        nationName: nationData.nationName,
        color: nationData.color,
      });
    } catch (error) {
      setIsSubmitting(false);
      setStep("nation");
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 opacity-30">
        <div className="absolute left-20 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl"></div>
        <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-secondary/10 blur-3xl"></div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-extrabold text-foreground">
              Welcome to eIntelligence
            </h1>
          </div>
          <p className="text-muted-foreground">
            Let's set up your nation and define your leadership style
          </p>
        </div>

        {/* Step indicator */}
        {step !== "welcome" && (
          <div className="mb-8">
            <div className="flex items-center gap-2">
              {["ideology", "nation"].map((s, index) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full transition-all ${
                      step === s || (step === "loading" && s === "nation")
                        ? "bg-primary h-3 w-3"
                        : s === "ideology"
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  ></div>
                  {index < 1 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <Card variant="elevated" className="p-6 sm:p-8">
          {step === "welcome" && (
            <WelcomeStep onContinue={() => setStep("ideology")} />
          )}
          {step === "ideology" && (
            <IdeologySelector
              onSubmit={handleIdeologySubmit}
              isLoading={isSubmitting}
            />
          )}
          {step === "nation" && (
            <NationSetup
              onSubmit={handleNationSubmit}
              isLoading={isSubmitting}
            />
          )}
          {step === "loading" && (
            <LoadingStep />
          )}
        </Card>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          This setup is optional but helps customize your experience. All choices can be changed later.
        </p>
      </div>
    </div>
  );
}

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">
          Before We Begin...
        </h2>
        <p className="text-muted-foreground">
          In eIntelligence, your leadership style matters. The decisions you make shape your nation's culture, values, and path forward.
        </p>
      </div>

      <div className="space-y-3">
        <p className="font-semibold text-foreground">We'll help you define:</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0"></span>
            <span>
              <strong>Your Ideology:</strong> Five dimensions that define your nation's values
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-secondary flex-shrink-0"></span>
            <span>
              <strong>Your Nation:</strong> Name and colors that represent your empire
            </span>
          </li>
        </ul>
      </div>

      <Card variant="subtle" className="p-4 border-primary/30 bg-primary/5">
        <p className="text-sm text-foreground">
          💡 <strong>Tip:</strong> Your ideology affects which policies work best, who naturally allies with you, and how citizens respond to your leadership.
        </p>
      </Card>

      <button
        onClick={onContinue}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
      >
        Let's Get Started
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function LoadingStep() {
  return (
    <div className="py-12 space-y-4 text-center">
      <div className="flex justify-center">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-muted border-t-primary animate-spin"></div>
        </div>
      </div>
      <h2 className="text-xl font-semibold text-foreground">
        Creating Your Nation...
      </h2>
      <p className="text-muted-foreground">
        Setting up your empire and initializing the world
      </p>
    </div>
  );
}
