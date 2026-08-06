'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
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
import { useSearchParams } from "next/navigation";
import { handleActionResponse, toastError } from "@/lib/toast-helpers";

export function LoginForm() {
  const t = useTranslations('Auth');
  const tNav = useTranslations('Navigation');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();

  // Check for error query parameter (from middleware redirects)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'account_inactive') {
      setError(t('accountInactive'));
    } else if (errorParam) {
      setError(t('errorOccurred'));
    }
  }, [searchParams, t]);

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
            setError(response.message || t('loginFailed'));
          },
          showToast: true, // Show toast notifications
        });
      } catch (e) {
        const errorMessage = e?.message || t('unexpectedError');
        setError(errorMessage);
        toastError(t('login'), errorMessage);
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
                <span className="relative">{t('login')}</span>
              </span>
            </p></CardTitle>
        <CardDescription>
          {t('enterEmailToLogin')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              required
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center">
              <Label htmlFor="password">{t('password')}</Label>
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
            {isPending ? t('loggingIn') : t('login')}
          </Button>
        </div>
        <div className="mt-4 text-center text-sm">
          {t('dontHaveAccount')}{" "}
          <Link href="/register/instructor" className="underline">
            {tNav('instructor')}
          </Link>
          {" "}{t('or')}{" "}
          <Link href="/register/student" className="underline">
            {tNav('student')}
          </Link>
        </div>
        </form>
      </CardContent>
    </Card>
  );
}
