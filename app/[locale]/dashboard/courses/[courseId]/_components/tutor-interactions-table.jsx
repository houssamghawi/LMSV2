"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const ALL_LESSONS = "__all__";
const ALL_STATUSES = "__all__";

export function TutorInteractionsTable({ courseId, lessons = [] }) {
    const t = useTranslations("Tutor");

    const [interactions, setInteractions] = React.useState([]);
    const [pagination, setPagination] = React.useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });
    const [contextStatus, setContextStatus] = React.useState(ALL_STATUSES);
    const [lessonId, setLessonId] = React.useState(ALL_LESSONS);
    const [dateFrom, setDateFrom] = React.useState("");
    const [dateTo, setDateTo] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    const fetchHistory = React.useCallback(async (page = 1) => {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
            courseId,
            page: String(page),
            limit: "20"
        });

        if (contextStatus !== ALL_STATUSES) {
            params.set("contextStatus", contextStatus);
        }
        if (lessonId !== ALL_LESSONS) {
            params.set("lessonId", lessonId);
        }
        if (dateFrom) {
            params.set("dateFrom", dateFrom);
        }
        if (dateTo) {
            params.set("dateTo", dateTo);
        }

        try {
            const res = await fetch(`/api/tutor/history?${params.toString()}`);
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.error || t("genericError"));
            }

            setInteractions(json.data.interactions);
            setPagination(json.data.pagination);
        } catch (err) {
            setError(err.message || t("genericError"));
            setInteractions([]);
        } finally {
            setLoading(false);
        }
    }, [courseId, contextStatus, lessonId, dateFrom, dateTo, t]);

    React.useEffect(() => {
        fetchHistory(1);
    }, [fetchHistory]);

    const statusBadge = (status) => {
        if (status === "answered") {
            return (
                <Badge className="bg-green-600">{t("contextStatusAnswered")}</Badge>
            );
        }
        return (
            <Badge variant="secondary">{t("contextStatusOutOfContext")}</Badge>
        );
    };

    const feedbackLabel = (feedback) => {
        if (feedback === "helpful") return t("feedbackHelpful");
        if (feedback === "not_helpful") return t("feedbackNotHelpful");
        return t("tableNoValue");
    };

    const noValue = t("tableNoValue");

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">
                        {t("columnStatus")}
                    </label>
                    <Select value={contextStatus} onValueChange={setContextStatus}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_STATUSES}>{t("filterAll")}</SelectItem>
                            <SelectItem value="answered">{t("filterAnswered")}</SelectItem>
                            <SelectItem value="out_of_context">
                                {t("filterOutOfContext")}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">
                        {t("columnLesson")}
                    </label>
                    <Select value={lessonId} onValueChange={setLessonId}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder={t("filterAllLessons")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_LESSONS}>{t("filterAllLessons")}</SelectItem>
                            {lessons.map((lesson) => (
                                <SelectItem key={lesson.id} value={lesson.id}>
                                    {lesson.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">
                        {t("filterDateFrom")}
                    </label>
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-[160px]"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">
                        {t("filterDateTo")}
                    </label>
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-[160px]"
                    />
                </div>
            </div>

            {error && (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            )}

            <div className="rounded-md border" aria-busy={loading}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("columnStudent")}</TableHead>
                            <TableHead>{t("columnQuestion")}</TableHead>
                            <TableHead>{t("columnResponse")}</TableHead>
                            <TableHead>{t("columnStatus")}</TableHead>
                            <TableHead>{t("columnLesson")}</TableHead>
                            <TableHead>{t("columnFeedback")}</TableHead>
                            <TableHead>{t("columnDate")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, index) => (
                                <TableRow key={`skeleton-${index}`}>
                                    <TableCell colSpan={7}>
                                        <Skeleton className="h-10 w-full" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : interactions.length ? (
                            interactions.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>
                                        <div className="font-medium">
                                            {row.studentName || noValue}
                                        </div>
                                        {row.studentEmail && (
                                            <div className="text-xs text-muted-foreground">
                                                {row.studentEmail}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="max-w-[220px]">
                                        <p className="truncate" title={row.question}>
                                            {row.question}
                                        </p>
                                    </TableCell>
                                    <TableCell className="max-w-[260px]">
                                        <p className="truncate" title={row.response}>
                                            {row.response}
                                        </p>
                                    </TableCell>
                                    <TableCell>{statusBadge(row.contextStatus)}</TableCell>
                                    <TableCell>{row.lessonTitle || noValue}</TableCell>
                                    <TableCell>{feedbackLabel(row.feedback)}</TableCell>
                                    <TableCell>
                                        {row.createdAt
                                            ? format(new Date(row.createdAt), "PPp")
                                            : noValue}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="p-0">
                                    <EmptyState
                                        title={t("analyticsTitle")}
                                        description={t("analyticsEmpty")}
                                        icon="notFound"
                                        className="min-h-[180px]"
                                    />
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {t("paginationSummary", {
                        total: pagination.total,
                        page: pagination.page,
                        totalPages: pagination.totalPages || 1
                    })}
                </p>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={loading || pagination.page <= 1}
                        onClick={() => fetchHistory(pagination.page - 1)}
                    >
                        {t("previous")}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={
                            loading ||
                            pagination.page >= (pagination.totalPages || 1)
                        }
                        onClick={() => fetchHistory(pagination.page + 1)}
                    >
                        {t("next")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
