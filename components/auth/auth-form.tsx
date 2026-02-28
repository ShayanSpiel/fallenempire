"use client";

import { useActionState, useId } from "react";
import { AlertCircle, CheckCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AuthActionState = {
  message?: string | null;
  error?: string | null;
};

const initialState: AuthActionState = { error: null };

type AuthFormProps = {
  title: string;
  subtitle?: string;
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  mode: "login" | "register";
};

export function AuthForm({ title, subtitle, action, mode }: AuthFormProps) {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(action, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isError = !!state?.error;
  const generatedId = useId();
  const formIdPrefix = `${generatedId}-${mode}`;
  const usernameId = `${formIdPrefix}-username`;
  const emailId = `${formIdPrefix}-email`;
  const passwordId = `${formIdPrefix}-password`;
  const confirmPasswordId = `${formIdPrefix}-confirm-password`;

  return (
    <form action={formAction} className="space-y-5">
      {/* Error Message with Animation */}
      {isError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/8 p-4 backdrop-blur-sm"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive/90" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive/90">{state?.error}</p>
          </div>
        </motion.div>
      )}

      {/* Username Field - Register Only */}
      {mode === "register" && (
        <div className="space-y-2">
          <Label htmlFor={usernameId} className="text-sm font-semibold text-foreground">
            Username
          </Label>
          <Input
            id={usernameId}
            name="username"
            placeholder="Choose a unique identifier"
            required
            minLength={3}
            maxLength={32}
            pattern="^[a-zA-Z0-9_-]+$"
            title="Username can only contain letters, numbers, underscores, and hyphens"
            className="transition-all focus:ring-2 focus:ring-primary/50 bg-background"
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground/70">
            3-32 characters, letters, numbers, underscores, and hyphens only
          </p>
        </div>
      )}

      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor={emailId} className="text-sm font-semibold text-foreground">
          Email Address
        </Label>
        <Input
          id={emailId}
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          className="transition-all focus:ring-2 focus:ring-primary/50 bg-background"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground/70">
          We'll use this to secure your account
        </p>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor={passwordId} className="text-sm font-semibold text-foreground">
          Password
        </Label>
        <div className="relative">
          <Input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={mode === "login" ? "Enter your password" : "Create a strong password"}
            required
            minLength={6}
            className="transition-all focus:ring-2 focus:ring-primary/50 pr-10 bg-background"
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
            disabled={isPending}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground/70">
          {mode === "register"
            ? "Minimum 6 characters"
            : "Case-sensitive"}
        </p>
      </div>

      {/* Confirm Password Field - Register Only */}
      {mode === "register" && (
        <div className="space-y-2">
          <Label htmlFor={confirmPasswordId} className="text-sm font-semibold text-foreground">
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              id={confirmPasswordId}
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm your password"
              required
              minLength={6}
              className="transition-all focus:ring-2 focus:ring-primary/50 pr-10 bg-background"
              disabled={isPending}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
              disabled={isPending}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full font-semibold font-nav bg-primary text-primary-foreground hover:bg-primary/90"
        size="lg"
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {mode === "login" ? "Signing in..." : "Creating account..."}
          </>
        ) : (
          <>
            {mode === "login" ? "Sign In" : "Create Account"}
          </>
        )}
      </Button>
    </form>
  );
}
