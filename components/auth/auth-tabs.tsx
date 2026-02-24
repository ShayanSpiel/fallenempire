"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { LogIn, UserPlus } from "lucide-react";

import { AuthActionState, AuthForm } from "@/components/auth/auth-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginAction, registerAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

type AuthTabsProps = {
  defaultOpen?: boolean;
  defaultTab?: "login" | "register";
  trigger?: ReactNode | null;
  ctaLabel?: string;
};

export function AuthTabs({
  defaultOpen = false,
  defaultTab = "login",
  trigger,
  ctaLabel = "Get Started",
}: AuthTabsProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const forcedByQueryRef = useRef(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
    forcedByQueryRef.current = defaultOpen;
  }, [defaultOpen]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!open && forcedByQueryRef.current && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      url.searchParams.delete("tab");
      url.searchParams.delete("next");
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", nextUrl);
      forcedByQueryRef.current = false;
    }
  }, [open]);

  const triggerNode = useMemo(() => {
    if (trigger === null) {
      return null;
    }

    if (trigger) {
      return trigger;
    }

    return (
      <Button className="mt-6 w-full max-w-xs" size="lg">
        {ctaLabel} <UserPlus className="ml-2 size-4" />
      </Button>
    );
  }, [trigger, ctaLabel]);

  const handleOpenChange = (value: boolean) => {
    if (!value && typeof document !== "undefined") {
      const activeElement = document.activeElement as HTMLElement | null;
      activeElement?.blur();
    }
    setOpen(value);
  };

  const handleFormState = async (
    action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>,
    state: AuthActionState,
    formData: FormData
  ) => {
    const result = await action(state, formData);
    if (!result.message && !result.error) {
      handleOpenChange(false);
    }
    return result;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {triggerNode && <DialogTrigger asChild>{triggerNode}</DialogTrigger>}
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-bold">
            {activeTab === "login"
              ? "Welcome Back, Leader"
              : "Claim Your Territory"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {activeTab === "login"
              ? "Sign in to continue your campaign and shape the world."
              : "Create your account to begin building your empire and shaping geopolitical futures."}
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "login" | "register")}
          className="w-full"
        >
        <TabsList className="grid w-full grid-cols-2 gap-2">
          <TabsTrigger value="login" size="md">
            <LogIn className="h-4 w-4" />
            <span>Sign In</span>
          </TabsTrigger>
          <TabsTrigger value="register" size="md">
            <UserPlus className="h-4 w-4" />
            <span>Register</span>
          </TabsTrigger>
        </TabsList>
          <TabsContent value="login" className="mt-6">
            <AuthForm
              title="Sign in to your account"
              subtitle="Enter your credentials to access the game."
              action={(state, formData) => handleFormState(loginAction, state, formData)}
              mode="login"
            />
          </TabsContent>
          <TabsContent value="register" className="mt-6">
            <AuthForm
              title="Create your new identity"
              subtitle="Choose a username, email, and password to start playing."
              action={(state, formData) => handleFormState(registerAction, state, formData)}
              mode="register"
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
