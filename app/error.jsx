'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/error-state'

export default function Error({
    error,
    reset,
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        // In production, integrate with Sentry or similar
        if (process.env.NODE_ENV === 'production') {
            // Example: Sentry.captureException(error);
        }
    }, [error])

    return (
        <ErrorState
            title="Something went wrong!"
            message="An unexpected error occurred. Please try again."
            error={error}
            onRetry={reset}
            showHomeButton={true}
        />
    )
}

