"use client";

import { useCallback, useEffect, useState } from "react";
import { getLessonEmbeddingStatusAction } from "@/app/actions/lesson";
import { LessonEmbeddingStatus } from "./lesson-embedding-status";

/**
 * Loads and displays embedding status for a lesson (client-side for use in modals).
 *
 * @param {object} props
 * @param {string} props.lessonId
 * @param {number} [props.refreshKey] - Increment to refetch after description save
 */
export function LessonEmbeddingStatusLoader({ lessonId, refreshKey = 0 }) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadStatus = useCallback(async () => {
        if (!lessonId) return;
        setLoading(true);
        try {
            const data = await getLessonEmbeddingStatusAction(lessonId);
            setStatus(data);
        } catch {
            setStatus({
                status: "failed",
                chunkCount: 0,
                embeddedAt: null,
                error: null
            });
        } finally {
            setLoading(false);
        }
    }, [lessonId]);

    useEffect(() => {
        loadStatus();
    }, [loadStatus, refreshKey]);

    useEffect(() => {
        if (status?.status !== "pending") return undefined;
        const timer = setInterval(loadStatus, 3000);
        return () => clearInterval(timer);
    }, [status?.status, loadStatus]);

    if (loading && !status) {
        return (
            <LessonEmbeddingStatus status="pending" chunkCount={0} embeddedAt={null} error={null} />
        );
    }

    if (!status) return null;

    return (
        <LessonEmbeddingStatus
            lessonId={lessonId}
            status={status.status}
            chunkCount={status.chunkCount}
            embeddedAt={status.embeddedAt}
            error={status.error}
            onRetryStarted={loadStatus}
        />
    );
}
