'use client';

import { useState, useEffect, useRef } from 'react';
import { CircleCheck, Loader2, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * Client component that polls for enrollment status
 * Polls every 2 seconds for up to 45 seconds
 */
export function EnrollmentStatusPoll({ sessionId, courseId, customerName, productName, initialIsPaid }) {
    const [status, setStatus] = useState({
        isPaid: initialIsPaid,
        isEnrolled: false,
        paymentStatus: 'checking',
        isLoading: true,
        error: null
    });
    const [pollCount, setPollCount] = useState(0);
    const [hasTimedOut, setHasTimedOut] = useState(false);
    const pollCountRef = useRef(0);

    const MAX_POLLS = 22; // 22 polls * 2 seconds = 44 seconds max
    const POLL_INTERVAL = 2000; // 2 seconds

    useEffect(() => {
        if (!sessionId || !sessionId.startsWith('cs_')) {
            setStatus(prev => ({
                ...prev,
                isLoading: false,
                error: 'Invalid session ID'
            }));
            return;
        }

        let pollInterval;
        let isMounted = true;

        const checkStatus = async () => {
            try {
                const response = await fetch(`/api/payments/status?session_id=${encodeURIComponent(sessionId)}`);
                const data = await response.json();

                if (!isMounted) return;

                if (!data.ok) {
                    setStatus(prev => ({
                        ...prev,
                        isLoading: false,
                        error: data.error || 'Failed to check status'
                    }));
                    return;
                }

                const currentPollCount = pollCountRef.current + 1;
                pollCountRef.current = currentPollCount;
                setPollCount(currentPollCount);

                setStatus({
                    isPaid: data.isPaid,
                    isEnrolled: data.isEnrolled,
                    paymentStatus: data.paymentStatus,
                    isLoading: false,
                    error: null
                });

                // Stop polling if enrolled or if we've reached max polls
                if (data.isEnrolled || currentPollCount >= MAX_POLLS) {
                    if (currentPollCount >= MAX_POLLS && !data.isEnrolled) {
                        setHasTimedOut(true);
                    }
                    if (pollInterval) {
                        clearInterval(pollInterval);
                    }
                }
            } catch (error) {
                if (!isMounted) return;
                console.error('Error checking enrollment status:', error);
                setStatus(prev => ({
                    ...prev,
                    isLoading: false,
                    error: 'Failed to check enrollment status'
                }));
                if (pollInterval) {
                    clearInterval(pollInterval);
                }
            }
        };

        // Initial check immediately
        checkStatus();

        // Set up polling interval
        pollInterval = setInterval(() => {
            if (pollCountRef.current < MAX_POLLS) {
                checkStatus();
            } else {
                clearInterval(pollInterval);
                setStatus(prev => {
                    if (!prev.isEnrolled) {
                        setHasTimedOut(true);
                    }
                    return prev;
                });
            }
        }, POLL_INTERVAL);

        return () => {
            isMounted = false;
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [sessionId]);

    // Manual refresh handler
    const handleRefresh = () => {
        setStatus(prev => ({ ...prev, isLoading: true, error: null }));
        pollCountRef.current = 0;
        setPollCount(0);
        setHasTimedOut(false);
        
        fetch(`/api/payments/status?session_id=${encodeURIComponent(sessionId)}`)
            .then(res => res.json())
            .then(data => {
                if (data.ok) {
                    setStatus({
                        isPaid: data.isPaid,
                        isEnrolled: data.isEnrolled,
                        paymentStatus: data.paymentStatus,
                        isLoading: false,
                        error: null
                    });
                } else {
                    setStatus(prev => ({
                        ...prev,
                        isLoading: false,
                        error: data.error || 'Failed to check status'
                    }));
                }
            })
            .catch(error => {
                console.error('Error refreshing status:', error);
                setStatus(prev => ({
                    ...prev,
                    isLoading: false,
                    error: 'Failed to refresh status'
                }));
            });
    };

    // Determine UI state
    const isPaid = status.isPaid;
    const isEnrolled = status.isEnrolled;
    const isPending = status.paymentStatus === 'pending' || status.paymentStatus === 'not_found';
    const isFailed = status.paymentStatus === 'failed' || status.paymentStatus === 'canceled';
    const isLoading = status.isLoading && !isEnrolled;

    return (
        <div className="flex flex-col items-center gap-6 max-w-[600px] text-center">
            {/* Success State */}
            {isPaid && isEnrolled && (
                <>
                    <CircleCheck className="w-32 h-32 bg-green-500 rounded-full p-0 text-white" />
                    <h1 className="text-xl md:text-2xl lg:text-3xl">
                        Congratulations! <strong>{customerName}</strong> Your Enrollment was Successful for <strong>{productName}</strong>
                    </h1>
                    <p className="text-muted-foreground">
                        You can now access all course content.
                    </p>
                </>
            )}

            {/* Processing State */}
            {isPaid && !isEnrolled && isLoading && !hasTimedOut && (
                <>
                    <Loader2 className="w-32 h-32 animate-spin text-primary" />
                    <h1 className="text-xl md:text-2xl lg:text-3xl">
                        Payment Confirmed
                    </h1>
                    <p className="text-muted-foreground">
                        Your payment was successful. We're setting up your enrollment. This may take a few moments.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Checking status... ({pollCount}/{MAX_POLLS})
                    </p>
                </>
            )}

            {/* Timeout State */}
            {isPaid && !isEnrolled && (hasTimedOut || (!isLoading && !isEnrolled && pollCount >= MAX_POLLS)) && (
                <>
                    <Loader2 className="w-32 h-32 animate-spin text-primary" />
                    <h1 className="text-xl md:text-2xl lg:text-3xl">
                        Setting Up Enrollment
                    </h1>
                    <p className="text-muted-foreground">
                        Your payment was successful. Enrollment is being processed.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        This may take a few more moments. Please check back in a minute or refresh the page.
                    </p>
                    <Button onClick={handleRefresh} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Check Again
                    </Button>
                </>
            )}

            {/* Pending Payment State */}
            {isPending && !isPaid && (
                <>
                    <Loader2 className="w-32 h-32 animate-spin text-primary" />
                    <h1 className="text-xl md:text-2xl lg:text-3xl">
                        Payment Processing
                    </h1>
                    <p className="text-muted-foreground">
                        Your payment is being processed. Please wait...
                    </p>
                </>
            )}

            {/* Failed Payment State */}
            {isFailed && (
                <>
                    <XCircle className="w-32 h-32 text-destructive" />
                    <h1 className="text-xl md:text-2xl lg:text-3xl">
                        Payment Failed
                    </h1>
                    <p className="text-muted-foreground">
                        Your payment could not be processed. Please try again.
                    </p>
                </>
            )}

            {/* Error State */}
            {status.error && (
                <>
                    <XCircle className="w-32 h-32 text-destructive" />
                    <h1 className="text-xl md:text-2xl lg:text-3xl">
                        Error Checking Status
                    </h1>
                    <p className="text-muted-foreground">
                        {status.error}
                    </p>
                    <Button onClick={handleRefresh} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                    </Button>
                </>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
                <Button asChild size="sm">
                    <Link href="/courses">Browse Courses</Link>
                </Button>
                {isPaid && isEnrolled && (
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/courses/${courseId}/lesson`}>Start Learning</Link>
                    </Button>
                )}
            </div>
        </div>
    );
}
