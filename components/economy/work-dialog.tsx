"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Hammer,
  Wheat,
  Mountain,
  Droplet,
  Package,
  Coins,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserCompany, UserEmployment, ProductionRecipe } from "@/lib/types/companies";
import { getRecipesByIds, performWork } from "@/app/actions/companies";
import { toast } from "sonner";
import { CurrencyDisplayCompact } from "@/components/ui/currency-display";

interface WorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: UserCompany | UserEmployment;
  companyType: "own" | "employed";
  userId: string;
  onWorkComplete: () => void;
}

export function WorkDialog({
  open,
  onOpenChange,
  company,
  companyType,
  userId,
  onWorkComplete,
}: WorkDialogProps) {
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const [recipes, setRecipes] = useState<ProductionRecipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<ProductionRecipe | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  // Load recipes when dialog opens
  useEffect(() => {
    if (!open) return;

    const loadRecipes = async () => {
      setIsLoadingRecipes(true);
      const recipeIds = company.available_recipes || [];
      const data = await getRecipesByIds(recipeIds);
      setRecipes(data);
      setIsLoadingRecipes(false);

      // Auto-select first recipe if only one option
      if (data.length === 1) {
        setSelectedRecipe(data[0]);
      }
    };

    loadRecipes();
  }, [open, company.available_recipes]);

  const handleWork = async () => {
    if (!selectedRecipe) return;

    setIsWorking(true);
    const result = await performWork({
      worker_id: userId,
      company_id: "company_id" in company ? company.company_id : company.id,
      recipe_id: selectedRecipe.id,
    });

    if (result.success) {
      toast.success("Work Complete!", {
        description: companyType === "own"
          ? "Production added to your inventory."
          : `You earned ${result.wage_earned || 0} community coins.`,
      });
      onWorkComplete();
    } else {
      toast.error("Work Failed", {
        description: result.error || "Failed to perform work",
      });
    }

    setIsWorking(false);
  };

  const companyName = "company_name" in company ? company.company_name : company.name;
  const companyTypeName = "company_type_name" in company ? company.company_type_name : (company as any).company_type_name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="h-5 w-5" />
            Work at {companyName}
          </DialogTitle>
          <DialogDescription>
            {companyType === "own"
              ? "Select a recipe to produce. Materials will be consumed from your inventory."
              : `Work for ${(company as any).wage_per_day_community_coin || 0} community currency per day. Owner provides materials.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Company Info */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-foreground">{companyName}</h4>
                <p className="text-xs text-muted-foreground">{companyTypeName}</p>
              </div>
              {companyType === "employed" && (
                <Badge variant="outline" className="gap-1">
                  <Coins className="h-3 w-3" />
                  {(company as any).wage_per_day_community_coin} currency/day
                </Badge>
              )}
            </div>
          </Card>

          {/* Recipe Selection */}
          {isLoadingRecipes ? (
            <div className="space-y-2">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : recipes.length === 0 ? (
            <Card className="p-6">
              <div className="flex flex-col items-center justify-center space-y-3">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  No production recipes available for this company type.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Select Recipe
              </label>
              <div className="grid gap-2">
                {recipes.map((recipe) => (
                  <RecipeOption
                    key={recipe.id}
                    recipe={recipe}
                    isSelected={selectedRecipe?.id === recipe.id}
                    onClick={() => setSelectedRecipe(recipe)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Work Button */}
          <Button
            onClick={handleWork}
            disabled={!selectedRecipe || isWorking}
            className="w-full gap-2"
            size="lg"
          >
            {isWorking ? (
              <>Working...</>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Perform Work
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// RECIPE OPTION
// ============================================================================

interface RecipeOptionProps {
  recipe: ProductionRecipe;
  isSelected: boolean;
  onClick: () => void;
}

function RecipeOption({ recipe, isSelected, onClick }: RecipeOptionProps) {
  const inputs = recipe.inputs as Record<string, number>;
  const outputs = recipe.outputs as Record<string, { base_quantity: number; quality_level: number }>;

  const hasInputs = Object.keys(inputs).length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-4 p-4 rounded-lg border transition-all text-left w-full",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border/60 bg-card hover:bg-muted/50"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
          isSelected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Hammer className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-foreground">{recipe.name}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{recipe.description}</p>

        <div className="flex items-center gap-3 mt-3 text-xs">
          {hasInputs && (
            <div className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5 text-red-500" />
              <span className="text-muted-foreground">
                {Object.values(inputs).reduce((sum, val) => sum + val, 0)} materials
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            <span className="text-muted-foreground">
              {Object.values(outputs).reduce((sum, val) => sum + val.base_quantity, 0)} products
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
