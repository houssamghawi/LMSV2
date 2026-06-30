"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { GENERATION_POLL_INTERVAL_MS } from "@/lib/constants";

/**
 * Polls GET /api/quiz-generation/jobs/[jobId] every 2s and renders the
 * generation lifecycle (queued -> running -> succeeded | failed). Auto-stops
 * on a terminal state. Calls onSucceeded(job) / onFailed(job) once.
 */
export function GenerationStatus({ jobId, onSucceeded, onFailed, autoStop = true }) {
    const t = useTranslations("QuizGeneration");
    const [job, setJob] = useState(null);
    const [error, setError] = useState(null);
    const stoppedRef = useRef(false);
    const handledRef = useRef({ succeeded: false, failed: false });

    useEffect(() => {
        if (!jobId) return;
        stoppedRef.current = false;
        handledRef.current = { succeeded: false, failed: false };
        let timer;

        async function tick() {
            try {
                const res = await fetch(`/api/quiz-generation/jobs/${jobId}`, {
                    cache: "no-store"
                });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const json = await res.json();
                if (!json.ok) {
                    throw new Error(json.error || "Poll failed");
                }
                setJob(json);
                setError(null);

                if (json.status === "succeeded" && !handledRef.current.succeeded) {
                    handledRef.current.succeeded = true;
                    onSucceeded?.(json);
                    if (autoStop) {
                        stoppedRef.current = true;
                        return;
                    }
                }
                if (json.status === "failed" && !handledRef.current.failed) {
                    handledRef.current.failed = true;
                    onFailed?.(json);
                    if (autoStop) {
                        stoppedRef.current = true;
                        return;
                    }
                }
            } catch (e) {
                setError(e?.message || "Poll failed");
            } finally {
                if (!stoppedRef.current) {
                    timer = setTimeout(tick, GENERATION_POLL_INTERVAL_MS);
                }
            }
        }

        tick();
        return () => {
            stoppedRef.current = true;
            if (timer) clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId]);

    if (!jobId) return null;

    const status = job?.status || "queued";
    const statusKey = `status${status.charAt(0).toUpperCase()}${status.slice(1)}`;

    return (
        <div
            className="rounded-lg border bg-white p-4 space-y-3"
            role="status"
            aria-live="polite"
            aria-busy={status === "queued" || status === "running"}
        >
            <div className="flex items-center gap-2">
                {status === "queued" && <Clock className="w-4 h-4 text-slate-500" />}
                {status === "running" && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                {status === "succeeded" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {status === "failed" && <AlertCircle className="w-4 h-4 text-red-600" />}
                <span className="font-medium" dir="auto">{t(statusKey)}</span>
            </div>

            {(status === "queued" || status === "running") && (
                <>
                    <Progress value={status === "queued" ? 5 : 50} />
                    <p className="text-sm text-slate-500" dir="auto">{t("pollingHint")}</p>
                </>
            )}

            {status === "failed" && (
                <p className="text-sm text-red-600" dir="auto">
                    {job?.failureReason || t("genericError")}
                </p>
            )}

            {error && (
                <div className="flex items-center justify-between gap-2 text-sm text-amber-700 bg-amber-50 rounded px-2 py-1">
                    <span dir="auto">{t("genericError")}</span>
                    <Button size="sm" variant="ghost" onClick={() => setError(null)}>
                        {t("aiProviderError")}
                    </Button>
                </div>
            )}
        </div>
    );
}
