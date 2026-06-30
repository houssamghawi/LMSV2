"use client"
import React, { useState, useTransition } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from '@/lib/utils';
import { enrollInFreeCourse } from '@/app/actions/enrollment';
import { toastSuccess, toastError } from '@/lib/toast-helpers';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const EnrollCourse = ({ asLink, courseId, coursePrice = null, isFree = false }) => {
    const router = useRouter();
    const t = useTranslations('Courses');
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');

    // Determine if course is free
    const isFreeCourse = isFree || (coursePrice !== null && coursePrice === 0);

    const handleEnroll = async (data) => {
        setError('');
        startTransition(async () => {
            try {
                let result;

                if (isFreeCourse) {
                    // Free course - enroll directly
                    result = await enrollInFreeCourse(data);

                    if (result.ok) {
                        toastSuccess(t('enrolled'), t('enrollmentSuccess'));
                        // Refresh page to show "Access Course" button
                        router.refresh();
                    } else {
                        const errorMessage = result.message || t('enrollFailedMessage');
                        setError(errorMessage);
                        toastError(t('enrollmentFailed'), errorMessage);
                    }
                } else {
                    // Paid course - redirect to mock checkout
                    router.push(`/checkout/mock?courseId=${courseId}`);
                }
            } catch (err) {
                const errorMessage = err?.message || 'An unexpected error occurred. Please try again.';
                setError(errorMessage);
                toastError(t('enrollmentFailed'), errorMessage);
            }
        });
    };

    return (
        <>
            <form action={handleEnroll}>
                <input type="hidden" name='courseId' value={courseId} />
                {error && (
                    <div className="mb-2 rounded-md bg-destructive/15 p-2 text-sm text-destructive">
                        {error}
                    </div>
                )}
                {asLink ? (
                    <Button
                        type="submit"
                        variant="ghost"
                        className="text-xs text-sky-700 h-7 gap-1"
                        disabled={isPending}
                    >
                        {isPending ? t('loading') : isFreeCourse ? t('enrollFree') : t('enroll')}
                        <ArrowRight className="w-3 rtl:rotate-180" />
                    </Button>
                ) : (
                    <Button
                        type="submit"
                        className={cn(buttonVariants({ size: "lg" }))}
                        disabled={isPending}
                    >
                        {isPending
                            ? t('processing')
                            : isFreeCourse
                                ? t('enrollFree')
                                : t('enrollNow')
                        }
                    </Button>
                )}
            </form>
        </>
    );
};

export default EnrollCourse;
