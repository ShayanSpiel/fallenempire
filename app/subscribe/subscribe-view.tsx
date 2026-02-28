"use client";

import { Shield, Crown, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { H1, H2, P, Small } from "@/components/ui/typography";
import Link from "next/link";

interface SubscribeViewProps {
  userTier: "alpha" | "sigma" | "omega";
}

export function SubscribeView({ userTier }: SubscribeViewProps) {
  const isAlpha = userTier === "alpha";
  const isSigma = userTier === "sigma";
  const isOmega = userTier === "omega";

  return (
    <div className="container max-w-4xl mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <H1>Become a Patron</H1>
        <P className="text-muted-foreground max-w-2xl mx-auto">
          Support the game's development and gain recognition as an honored member of the community.
        </P>
      </div>

      {/* Current Status */}
      {!isAlpha && (
        <Card className="border-2 border-primary/50 bg-primary/5">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isSigma ? (
                <Shield className="w-5 h-5 text-blue-500" />
              ) : (
                <Crown className="w-5 h-5 text-amber-500" />
              )}
              <span className="font-semibold">
                You are a {isSigma ? "Sigma" : "Omega"} Patron
              </span>
            </div>
            <Small className="text-muted-foreground">
              Thank you for your continued support.
            </Small>
          </CardContent>
        </Card>
      )}

      {/* Tier Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Sigma Tier */}
        <Card
          className={cn(
            "border-2 transition-all",
            isSigma
              ? "border-blue-500/50 bg-blue-500/5"
              : "border-border hover:border-blue-500/30"
          )}
        >
          <CardContent className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <H2 className="mb-0">Sigma</H2>
                  <Small className="text-muted-foreground">Patron</Small>
                </div>
              </div>
              {isSigma && (
                <div className="px-2 py-1 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                  Active
                </div>
              )}
            </div>

            {/* Price */}
            <div className="py-4 border-y border-border">
              <div className="text-3xl font-bold">$9.99</div>
              <Small className="text-muted-foreground">per month</Small>
            </div>

            {/* What You Get */}
            <div className="space-y-3">
              <div className="text-sm font-semibold text-muted-foreground">
                What you gain:
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>Sigma badge displayed on your profile</span>
                </li>
                <li className="flex items-start gap-2">
                  <Heart className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>Supporter medal that grows each month</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                  <span>Access to premium theme</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                  <span>Keeper Battle Pass (2x rewards)</span>
                </li>
              </ul>
            </div>

            {/* CTA */}
            <Button
              className={cn(
                "w-full",
                isSigma
                  ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30 cursor-default"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
              disabled={isSigma}
              asChild={!isSigma}
            >
              {isSigma ? (
                <span>Current Tier</span>
              ) : (
                <a href="#coming-soon">Become a Sigma Patron</a>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Omega Tier */}
        <Card
          className={cn(
            "border-2 transition-all",
            isOmega
              ? "border-amber-500/50 bg-amber-500/5"
              : "border-border hover:border-amber-500/30"
          )}
        >
          <CardContent className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <H2 className="mb-0">Omega</H2>
                  <Small className="text-muted-foreground">Elite Patron</Small>
                </div>
              </div>
              {isOmega && (
                <div className="px-2 py-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                  Active
                </div>
              )}
            </div>

            {/* Price */}
            <div className="py-4 border-y border-border">
              <div className="text-3xl font-bold">$14.99</div>
              <Small className="text-muted-foreground">per month</Small>
            </div>

            {/* What You Get */}
            <div className="space-y-3">
              <div className="text-sm font-semibold text-muted-foreground">
                Everything in Sigma, plus:
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Crown className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>Prestigious Omega badge with golden glow</span>
                </li>
                <li className="flex items-start gap-2">
                  <Heart className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>Elite supporter medal recognition</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                  <span>Access to all exclusive themes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                  <span>Maximum prestige and standing</span>
                </li>
              </ul>
            </div>

            {/* CTA */}
            <Button
              className={cn(
                "w-full",
                isOmega
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 cursor-default"
                  : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
              )}
              disabled={isOmega}
              asChild={!isOmega}
            >
              {isOmega ? (
                <span>Current Tier</span>
              ) : (
                <a href="#coming-soon">Become an Omega Patron</a>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Support Message */}
      <Card className="bg-muted/30">
        <CardContent className="p-8 text-center space-y-4">
          <Heart className="w-8 h-8 mx-auto text-muted-foreground" />
          <div>
            <H2>Why Support?</H2>
            <P className="text-muted-foreground mt-2">
              Your support directly funds development, keeps servers running, and helps build new
              features for the entire community. Beyond the perks, you gain status and recognition
              as a valued patron who believes in this project.
            </P>
          </div>
          <div className="pt-4 space-y-2 text-sm text-muted-foreground">
            <p>• Supporter medals are permanent achievements</p>
            <p>• Your badge shows your commitment to the community</p>
            <p>• Cancel anytime, keep what you've earned</p>
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon Notice */}
      <div id="coming-soon" className="text-center py-8">
        <Small className="text-muted-foreground">
          Payment integration coming soon. For now, subscriptions are managed manually.
          <br />
          Contact the development team if you'd like to support early.
        </Small>
      </div>

      {/* Back Link */}
      <div className="text-center">
        <Link href="/feed">
          <Button variant="ghost" size="sm">
            ← Back to Feed
          </Button>
        </Link>
      </div>
    </div>
  );
}
