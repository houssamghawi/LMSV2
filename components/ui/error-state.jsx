"use client";

import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Reusable Error State Component
 * Use this for displaying errors in pages/components
 */
export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading this content.",
  error,
  onRetry,
  showHomeButton = true,
  retryLabel,
  homeLabel,
  className = "",
}) {
  return (
    <div className={`flex min-h-[400px] items-center justify-center p-4 ${className}`}>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && error && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-mono text-xs text-destructive">
                {error instanceof Error ? error.message : String(error)}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            {onRetry && (
              <Button onClick={onRetry} className="flex-1">
                <RefreshCw className="me-2 h-4 w-4" />
                {retryLabel ?? "Try again"}
              </Button>
            )}
            {showHomeButton && (
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/")}
                className="flex-1"
              >
                <Home className="me-2 h-4 w-4" />
                {homeLabel ?? "Go home"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

