'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function Error({
  error,
  reset,
}) {
  const t = useTranslations('Admin')

  useEffect(() => {
    console.error('Admin page error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>{t('somethingWentWrong')}</CardTitle>
          </div>
          <CardDescription>
            {t('adminErrorOccurred')}
            {error?.message && (
              <div className="mt-2 text-sm text-red-600 font-mono">
                {error.message}
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={reset} className="w-full">
            {t('tryAgain')}
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/admin'} className="w-full">
            {t('goToDashboard')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

