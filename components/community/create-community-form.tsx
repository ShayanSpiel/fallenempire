"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Crown, Loader2, Plus, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { borders } from "@/lib/design-system";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCommunityAction, type CommunityActionState } from "@/app/actions/community";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "@/components/ui/color-picker";
import { VariantProps } from "class-variance-authority";
import { showCommunityToast } from "@/lib/toast-utils";

const initialState: CommunityActionState = { message: null, error: null };

type CommunityFormBodyProps = {
  onSuccess: (payload: {
    message: string | null;
    communityId: string | null;
    communitySlug: string | null;
  }) => void;
};

type TriggerVariant = VariantProps<typeof buttonVariants>["variant"];
type TriggerSize = VariantProps<typeof buttonVariants>["size"];

function CommunityFormBody({ onSuccess }: CommunityFormBodyProps) {
  const [state, formAction] = React.useActionState(createCommunityAction, initialState);
  const [color, setColor] = useState("#3b82f6");
  const [governanceType, setGovernanceType] = useState("monarchy");
  const formRef = useRef<HTMLFormElement>(null);
  const hasSuccess = Boolean(state?.message && !state.error);

  useEffect(() => {
    if (hasSuccess) {
      formRef.current?.reset();
      setColor("#3b82f6");
      setGovernanceType("monarchy");
      onSuccess({
        message: state?.message ?? null,
        communityId: state?.communityId ?? null,
        communitySlug: state?.communitySlug ?? null,
      });
    }
  }, [hasSuccess, onSuccess, state]);

  const feedbackMessage = useMemo(() => {
    if (state?.error) {
      return <p className="text-sm font-semibold text-destructive">Error: {state.error}</p>;
    }
    if (state?.message) {
      return <p className="text-sm font-semibold text-primary">{state.message}</p>;
    }
    return null;
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Community Name</Label>
        <Input id="name" name="name" required minLength={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ideologyLabel">Ideology Label</Label>
        <Input id="ideologyLabel" name="ideologyLabel" required minLength={3} placeholder="e.g., Digital Rebels" />
      </div>

      <div className="space-y-2">
        <Label>Community Color</Label>
        <ColorPicker value={color} onChange={setColor} />
        <input type="hidden" name="color" value={color} />
        <p className="text-[10px] text-muted-foreground">
          This color will identify your cities on the global map.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Short Description</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="A brief manifesto for the new movement."
          required
          minLength={10}
        />
      </div>

      <div className="space-y-2">
        <Label>Governance Type</Label>
        <div className="grid grid-cols-3 gap-2">
          {/* Kingdom - Active */}
          <button
            type="button"
            onClick={() => setGovernanceType("monarchy")}
            className={cn(
              `p-3 rounded-lg ${borders.thin} transition-all flex flex-col items-center gap-2`,
              governanceType === "monarchy"
                ? "border-primary bg-primary/10"
                : "border-border/50 bg-muted/20"
            )}
          >
            <Crown className="h-5 w-5" />
            <span className="text-xs font-semibold">Kingdom</span>
          </button>

          {/* Democracy - Disabled */}
          <button
            type="button"
            disabled
            className={`p-3 rounded-lg ${borders.thin} border-border/30 bg-muted/30 opacity-50 cursor-not-allowed flex flex-col items-center gap-2`}
          >
            <span className="text-xl">⚖️</span>
            <span className="text-xs font-semibold">Democracy</span>
          </button>

          {/* Dictatorship - Disabled */}
          <button
            type="button"
            disabled
            className={`p-3 rounded-lg ${borders.thin} border-border/30 bg-muted/30 opacity-50 cursor-not-allowed flex flex-col items-center gap-2`}
          >
            <span className="text-xl">⚡</span>
            <span className="text-xs font-semibold">Dictatorship</span>
          </button>
        </div>
        <input type="hidden" name="governanceType" value={governanceType} />
        <p className="text-[10px] text-muted-foreground">
          More governance types coming soon.
        </p>
      </div>

      {feedbackMessage}

      <SubmitButton hasSuccess={hasSuccess} />
    </form>
  );
}

type CreateCommunityFormProps = {
  triggerClassName?: string;
  triggerVariant?: TriggerVariant;
  triggerSize?: TriggerSize;
  triggerLabel?: React.ReactNode;
};

export function CreateCommunityForm({
  triggerClassName,
  triggerVariant = "follow",
  triggerSize = "lg",
  triggerLabel,
}: CreateCommunityFormProps) {
  const [open, setOpen] = useState(false);
  const [formInstance, setFormInstance] = useState(0);
  const router = useRouter();

  const resetForm = () => {
    setFormInstance((value) => value + 1);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant={triggerVariant}
            size={triggerSize}
            className={cn("px-8", triggerClassName)}
          >
          {triggerLabel ?? (
            <>
              Create <Plus size={16} className="ml-2" />
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Community</DialogTitle>
          <DialogDescription>
            Lead a new network. Your first post will define its direction.
          </DialogDescription>
        </DialogHeader>

        <CommunityFormBody
          key={formInstance}
          onSuccess={({ message, communityId, communitySlug }) => {
            const resolvedSlug = (communitySlug ?? communityId ?? "").trim();
            showCommunityToast(message ?? "Community created.", "success");
            setOpen(false);
            resetForm();
            if (resolvedSlug) {
              router.push(`/community/${encodeURIComponent(resolvedSlug)}`);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({ hasSuccess }: { hasSuccess: boolean }) {
  const { pending } = useFormStatus();
  const icon = pending ? (
    <Loader2 size={16} className="mr-2 animate-spin" />
  ) : hasSuccess ? (
    <CheckCircle2 size={16} className="mr-2" />
  ) : (
    <UserPlus size={16} className="mr-2" />
  );

  const label = pending
    ? "Creating..."
    : hasSuccess
    ? "Community Created!"
    : "Create & Join";

  return (
    <Button type="submit" className="w-full" disabled={pending || hasSuccess}>
      {icon}
      {label}
    </Button>
  );
}
