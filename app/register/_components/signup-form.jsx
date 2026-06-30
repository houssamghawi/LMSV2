'use client'
import Link from "next/link";
import { useState, useTransition } from "react";

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
import { useRouter } from "next/navigation";
import { toastSuccess, toastError } from "@/lib/toast-helpers";

export function SignupForm({role}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isPending, startTransition] = useTransition();

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const firstName = formData.get("first-name");
    const lastName = formData.get("last-name");
    const email = formData.get("email");
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    // Client-side password match validation
    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords don't match" });
      toastError('Validation failed', "Passwords don't match");
      return;
    }

    const userRole = ((role === "student" ) || (role === "instructor")) ? role : "student";

    startTransition(async () => {
      try {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            userRole 
          })
        });

        const data = await response.json();

        if (response.ok && response.status === 201) {
          toastSuccess('Account created successfully!', 'You can now log in.');
          // Small delay to show toast before redirect
          setTimeout(() => {
            router.push("/login");
          }, 500);
        } else {
          // Handle error response with field-level errors
          if (data.details?.fieldErrors) {
            setFieldErrors(data.details.fieldErrors);
            // Show first field error as main error
            const firstFieldError = Object.values(data.details.fieldErrors)[0];
            if (firstFieldError) {
              setError(firstFieldError);
            }
          } else {
            const errorMessage = data.message || data.error || 'Registration failed. Please try again.';
            setError(errorMessage);
          }
          
          toastError('Registration failed', data.message || 'Please check your input and try again.');
        }
      } catch (e) {
        const errorMessage = e?.message || 'An unexpected error occurred. Please try again.';
        setError(errorMessage);
        toastError('Registration failed', errorMessage);
      }
    });
  }


  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">
        <p className="mt-5 text-3xl font-bold leading-tight text-gray-900 sm:leading-tight sm:text-5xl lg:text-3xl lg:leading-tight font-pj">
       <span className="relative inline-flex sm:inline">
                <span className="bg-gradient-to-r from-[#44BCFF] via-[#FF44EC] to-[#FF675E] blur-lg filter opacity-30 w-full h-full absolute inset-0"></span>
                <span className="relative">Sign Up</span>
          </span>
            </p></CardTitle>
        <CardDescription>
          Enter your information to create an account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} >
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="first-name">First name</Label>
            <Input 
              id="first-name" 
              name="first-name" 
              placeholder="Max" 
              required 
              className={fieldErrors.firstName ? 'border-destructive' : ''}
            />
            {fieldErrors.firstName && (
              <p className="text-sm text-destructive">{fieldErrors.firstName}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input 
              id="last-name" 
              name="last-name"  
              placeholder="Robinson" 
              required 
              className={fieldErrors.lastName ? 'border-destructive' : ''}
            />
            {fieldErrors.lastName && (
              <p className="text-sm text-destructive">{fieldErrors.lastName}</p>
            )}
          </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email" 
              type="email"
              placeholder="m@example.com"
              required
              className={fieldErrors.email ? 'border-destructive' : ''}
            />
            {fieldErrors.email && (
              <p className="text-sm text-destructive">{fieldErrors.email}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              name="password" 
              type="password" 
              required
              className={fieldErrors.password ? 'border-destructive' : ''}
            />
            {fieldErrors.password && (
              <p className="text-sm text-destructive">{fieldErrors.password}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, number, and special character
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input 
              id="confirmPassword" 
              name="confirmPassword" 
              type="password" 
              required
              className={fieldErrors.confirmPassword ? 'border-destructive' : ''}
            />
            {fieldErrors.confirmPassword && (
              <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
            )}
          </div>
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Creating account...' : 'Create an account'}
          </Button>
        </div>
        <div className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </div>
        </form>

      </CardContent>
    </Card>
  );
}
