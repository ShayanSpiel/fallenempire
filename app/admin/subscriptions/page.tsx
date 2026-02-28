"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getAllSubscriptions,
  createSubscription,
  updateSubscription,
  renewSubscription,
  awardSupporterMedal,
} from "@/app/actions/subscription";
import type { Subscription } from "@/lib/subscriptions/types";
import { toast } from "sonner";
import { Shield, Crown, Calendar, DollarSign, Award } from "lucide-react";
import Link from "next/link";

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Array<Subscription & { username?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [newSubUserId, setNewSubUserId] = useState("");
  const [newSubTier, setNewSubTier] = useState<"sigma" | "omega">("sigma");
  const [newSubDuration, setNewSubDuration] = useState("30");

  useEffect(() => {
    loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    setIsLoading(true);
    const result = await getAllSubscriptions();
    if (result.success && result.subscriptions) {
      setSubscriptions(result.subscriptions);
    } else {
      toast.error(result.error || "Failed to load subscriptions");
    }
    setIsLoading(false);
  }

  async function handleCreateSubscription() {
    if (!newSubUserId.trim()) {
      toast.error("Please enter a user ID");
      return;
    }

    setIsCreating(true);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(newSubDuration));

    const result = await createSubscription({
      userId: newSubUserId.trim(),
      tier: newSubTier,
      paymentProvider: "manual",
      expiresAt: expiresAt.toISOString(),
    });

    setIsCreating(false);

    if (result.success) {
      toast.success("Subscription created successfully!");
      setNewSubUserId("");
      loadSubscriptions();
    } else {
      toast.error(result.error || "Failed to create subscription");
    }
  }

  async function handleCancelSubscription(subscriptionId: string) {
    const result = await updateSubscription({
      subscriptionId,
      status: "cancelled",
      notes: "Cancelled by admin",
    });

    if (result.success) {
      toast.success("Subscription cancelled");
      loadSubscriptions();
    } else {
      toast.error(result.error || "Failed to cancel subscription");
    }
  }

  async function handleRenewSubscription(subscriptionId: string) {
    const result = await renewSubscription(subscriptionId);

    if (result.success) {
      toast.success("Subscription renewed and medal awarded!");
      loadSubscriptions();
    } else {
      toast.error(result.error || "Failed to renew subscription");
    }
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscription Management</h1>
          <p className="text-muted-foreground mt-1">Manage user subscriptions and supporter medals</p>
        </div>
        <Link href="/admin">
          <Button variant="outline">Back to Admin</Button>
        </Link>
      </div>

      {/* Create Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>Create Manual Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                placeholder="Enter user UUID"
                value={newSubUserId}
                onChange={(e) => setNewSubUserId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier">Tier</Label>
              <Select value={newSubTier} onValueChange={(value: "sigma" | "omega") => setNewSubTier(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sigma">Sigma ($9.99)</SelectItem>
                  <SelectItem value="omega">Omega ($14.99)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (Days)</Label>
              <Input
                id="duration"
                type="number"
                value={newSubDuration}
                onChange={(e) => setNewSubDuration(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCreateSubscription}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? "Creating..." : "Create Subscription"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions ({subscriptions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading subscriptions...</div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No subscriptions found</div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 border rounded-lg space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {sub.tier === "sigma" ? (
                        <Shield className="w-5 h-5 text-blue-500" />
                      ) : (
                        <Crown className="w-5 h-5 text-amber-500" />
                      )}
                      <div>
                        <div className="font-semibold">
                          {sub.username || "Unknown User"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {sub.user_id}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={sub.status === "active" ? "default" : "secondary"}
                        className={
                          sub.status === "active"
                            ? "bg-green-500/20 text-green-700 dark:text-green-400"
                            : ""
                        }
                      >
                        {sub.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          sub.tier === "sigma"
                            ? "border-blue-500/50 text-blue-600 dark:text-blue-400"
                            : "border-amber-500/50 text-amber-600 dark:text-amber-400"
                        }
                      >
                        {sub.tier.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Started</div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(sub.started_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Expires</div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "Never"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Months</div>
                      <div className="flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        {sub.months_subscribed}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Provider</div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {sub.payment_provider}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {sub.status === "active" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRenewSubscription(sub.id)}
                      >
                        Renew & Award Medal
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleCancelSubscription(sub.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
