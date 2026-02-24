"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronRight, RotateCw } from "lucide-react";

interface IdeologySlider {
  id: keyof typeof dimensions;
  label: string;
  left: string;
  right: string;
  description: string;
}

const dimensions = {
  order_chaos: "Order vs Chaos",
  self_community: "Self vs Community",
  logic_emotion: "Logic vs Emotion",
  power_harmony: "Power vs Harmony",
  tradition_innovation: "Tradition vs Innovation",
} as const;

const sliders: IdeologySlider[] = [
  {
    id: "order_chaos",
    label: "Order vs Chaos",
    left: "Order",
    right: "Chaos",
    description:
      "How much do you value structure, rules, and predictability? Or do you prefer freedom, spontaneity, and unpredictability?",
  },
  {
    id: "self_community",
    label: "Self vs Community",
    left: "Self",
    right: "Community",
    description:
      "Do you prioritize individual rights and autonomy? Or collective welfare and group harmony?",
  },
  {
    id: "logic_emotion",
    label: "Logic vs Emotion",
    left: "Logic",
    right: "Emotion",
    description:
      "Do you make decisions based on data and reason? Or on intuition and feelings?",
  },
  {
    id: "power_harmony",
    label: "Power vs Harmony",
    left: "Power",
    right: "Harmony",
    description:
      "Do you seek dominance, competition, and strength? Or peace, cooperation, and balance?",
  },
  {
    id: "tradition_innovation",
    label: "Tradition vs Innovation",
    left: "Tradition",
    right: "Innovation",
    description:
      "Do you prefer proven traditions and stability? Or new ideas and progress?",
  },
];

interface IdeologyValues {
  order_chaos: number;
  self_community: number;
  logic_emotion: number;
  power_harmony: number;
  tradition_innovation: number;
}

interface IdeologySelectorProps {
  onSubmit: (ideology: IdeologyValues) => Promise<void>;
  isLoading?: boolean;
}

export function IdeologySelector({ onSubmit, isLoading = false }: IdeologySelectorProps) {
  const [values, setValues] = useState<IdeologyValues>({
    order_chaos: 0,
    self_community: 0,
    logic_emotion: 0,
    power_harmony: 0,
    tradition_innovation: 0,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleSliderChange = (dimension: keyof typeof dimensions, value: number) => {
    setValues((prev) => ({
      ...prev,
      [dimension]: value,
    }));
  };

  const handleNext = () => {
    if (currentStep < sliders.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    setValues({
      order_chaos: 0,
      self_community: 0,
      logic_emotion: 0,
      power_harmony: 0,
      tradition_innovation: 0,
    });
    setCurrentStep(0);
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    try {
      await onSubmit(values);
    } catch (error) {
      setSubmitted(false);
    }
  };

  const currentSlider = sliders[currentStep];
  const currentValue = values[currentSlider.id];
  const progress = ((currentStep + 1) / sliders.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Define Your Ideology
          </p>
          <p className="text-xs text-muted-foreground">
            {currentStep + 1} of {sliders.length}
          </p>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Slider question */}
      <Card variant="subtle" className="p-6">
        <div className="space-y-4">
          {/* Question */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {currentSlider.label}
            </h3>
            <p className="text-sm text-muted-foreground">
              {currentSlider.description}
            </p>
          </div>

          {/* Slider */}
          <div className="space-y-3">
            <input
              type="range"
              min="-100"
              max="100"
              value={currentValue}
              onChange={(e) => handleSliderChange(currentSlider.id, Number(e.target.value))}
              className="w-full h-2 bg-gradient-to-r from-primary/30 to-secondary/30 rounded-lg appearance-none cursor-pointer accent-primary"
              disabled={isLoading}
            />

            {/* Labels */}
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold transition-colors ${
                  currentValue < -30
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {currentSlider.left}
              </span>
              <span
                className={`text-xs font-semibold transition-colors ${
                  currentValue > 30
                    ? "text-secondary"
                    : "text-muted-foreground"
                }`}
              >
                {currentSlider.right}
              </span>
            </div>

            {/* Value display */}
            <div className="flex items-center justify-center">
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-full transition-colors ${
                  currentValue === 0
                    ? "bg-muted text-muted-foreground"
                    : currentValue < 0
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary/20 text-secondary"
                }`}
              >
                {currentValue === 0
                  ? "Neutral"
                  : `${currentSlider.left}: ${Math.abs(currentValue)}%`}
                {currentValue > 0 &&
                  ` | ${currentSlider.right}: ${Math.abs(currentValue)}%`}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Navigation buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0 || isLoading}
          className="flex-1"
        >
          Previous
        </Button>
        {currentStep === sliders.length - 1 ? (
          <Button
            onClick={handleSubmit}
            disabled={submitted || isLoading}
            className="flex-1 gap-2"
          >
            {submitted ? "Setting up..." : "Create Nation"}
            {!submitted && <ChevronRight className="h-4 w-4" />}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            className="flex-1 gap-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Reset button */}
      <button
        type="button"
        onClick={handleReset}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        <RotateCw className="h-3 w-3" />
        Reset all answers
      </button>
    </div>
  );
}
