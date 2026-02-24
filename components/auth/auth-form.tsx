"use client";

import { useActionState, useId } from "react";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AuthActionState = {
  message: string | null;
  error?: string | null;
};

const initialState: AuthActionState = { message: null };

type AuthFormProps = {
  title: string;
  subtitle?: string;
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  mode: "login" | "register";
};

export function AuthForm({ title, subtitle, action, mode }: AuthFormProps) {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(action, initialState);
  const isError = !!state?.error;
  const isSuccess = state?.message && !isError;
  const generatedId = useId();
  const formIdPrefix = `${generatedId}-${mode}`;
  const usernameId = `${formIdPrefix}-username`;
  const emailId = `${formIdPrefix}-email`;
  const passwordId = `${formIdPrefix}-password`;

  return (
    <form action={formAction} className="space-y-5">
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
            className="transition-all focus:ring-2 focus:ring-primary/50"
          />
          <p className="text-xs text-muted-foreground">
            3-32 characters, letters/numbers only
          </p>
        </div>
      )}

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
          className="transition-all focus:ring-2 focus:ring-primary/50"
        />
        <p className="text-xs text-muted-foreground">
          We'll never share your email with anyone
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={passwordId} className="text-sm font-semibold text-foreground">
          Password
        </Label>
        <Input
          id={passwordId}
          name="password"
          type="password"
          placeholder={mode === "login" ? "••••••••" : "Create a strong password"}
          required
          minLength={6}
          className="transition-all focus:ring-2 focus:ring-primary/50"
        />
        <p className="text-xs text-muted-foreground">
          {mode === "register"
            ? "Minimum 6 characters"
            : "Case-sensitive"}
        </p>
      </div>

      {isError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{state?.error}</p>
        </div>
      )}

      {isSuccess && (
        <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-3">
          <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
          <p className="text-sm text-success">{state?.message}</p>
        </div>
      )}

      <Button
        type="submit"
        className="w-full font-semibold"
        size="lg"
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending && (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        )}
        {isPending
          ? mode === "login"
            ? "Signing in..."
            : "Creating account..."
          : mode === "login"
            ? "Sign In to Your Account"
            : "Create Your Account"}
      </Button>

      {/* Google Login Button - Placeholder */}
      <Button
        type="button"
        variant="outline"
        className="w-full font-semibold"
        size="lg"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {mode === "login" ? (
          <>
            No account yet?{" "}
            <button
              type="button"
              className="font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Create one
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </form>
  );
}
