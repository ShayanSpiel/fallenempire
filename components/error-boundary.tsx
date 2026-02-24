"use client";

import React, { ReactNode } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  section?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * Error Boundary component to catch and handle React component errors
 * Prevents entire app crash from a single component failure
 *
 * Usage:
 * <ErrorBoundary section="MapComponent" onError={handleError}>
 *   <HexMap {...props} />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log error for debugging
    console.error(
      `Error caught by boundary${this.props.section ? ` (${this.props.section})` : ""}:`,
      error,
      errorInfo
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col gap-3 p-6 rounded-lg border border-destructive/30 bg-destructive/5 min-h-[200px] justify-center">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-destructive mb-1">
                {this.props.section ? `${this.props.section} Error` : "Something went wrong"}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                {this.state.error?.message || "An unexpected error occurred. Try refreshing the page."}
              </p>
              {process.env.NODE_ENV === "development" && this.state.errorInfo && (
                <details className="text-xs text-muted-foreground mb-3 cursor-pointer">
                  <summary className="font-mono hover:text-foreground">Stack trace</summary>
                  <pre className="bg-muted p-2 rounded mt-2 overflow-auto max-h-40 text-[10px]">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={this.handleRetry}
              className="gap-1"
            >
              <RotateCw className="w-3 h-3" />
              Try Again
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
