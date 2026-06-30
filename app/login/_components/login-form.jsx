'use client'
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { credentialLogin } from "@/app/actions";
import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { handleActionResponse, toastError } from "@/lib/toast-helpers";

export function LoginForm() {
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for error query parameter (from middleware redirects)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'account_inactive') {
      setError('Your account is inactive or has been suspended. Please contact support.');
    } else if (errorParam) {
      setError('An error occurred. Please try again.');
    }
  }, [searchParams]);

  async function onSubmit(event) {
    event.preventDefault();
    setError('');

    const formData = new FormData(event.currentTarget);
    
    startTransition(async () => {
      try {
        const response = await credentialLogin(formData);

        // Use standardized response handler
        handleActionResponse(response, {
          onSuccess: () => {
            // Get redirect URL from response data or callbackUrl query param
            const callbackUrl = searchParams.get('callbackUrl');
            const redirectUrl = callbackUrl || response.data?.redirectUrl || '/';
            
            // Use window.location for full page reload to ensure session is fresh
            window.location.href = redirectUrl;
          },
          onError: (fieldErrors) => {
            // Set error message for display
            setError(response.message || 'Login failed. Please check your credentials.');
          },
          showToast: true, // Show toast notifications
        });
      } catch (e) {
        // Fallback error handling
        const errorMessage = e?.message || 'An unexpected error occurred. Please try again.';
        setError(errorMessage);
        toastError('Login failed', errorMessage);
      }
    });
  }






  return (
    <Card className="mx-auto max-w-sm w-full">
      <CardHeader>
        <CardTitle className="text-2xl">
        <p className="mt-5 text-3xl font-bold leading-tight text-gray-900 sm:leading-tight sm:text-5xl lg:text-3xl lg:leading-tight font-pj">
              <span className="relative inline-flex sm:inline">
                <span className="bg-gradient-to-r from-[#44BCFF] via-[#FF44EC] to-[#FF675E] blur-lg filter opacity-30 w-full h-full absolute inset-0"></span>
                <span className="relative">Login</span>
              </span>
            </p></CardTitle>
        <CardDescription>
          Enter your email below to login to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="m@example.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center">
              <Label htmlFor="password">Password</Label>
              {/* <Link href="#" className="ml-auto inline-block text-sm underline">
                Forgot your password?
              </Link> */}
            </div>
            <Input id="password" name="password" type="password" required />
          </div>
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Logging in...' : 'Login'}
          </Button>
        </div>
        <div className="mt-4 text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/register/instructor" className="underline">
          Instructor
          </Link>
          {" "} or {" "}
          <Link href="/register/student" className="underline">
          Student
          </Link>
        </div>
        </form>
      </CardContent>
    </Card>
  );
}
