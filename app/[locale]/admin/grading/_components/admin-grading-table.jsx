"use client";

import { useTranslations, useFormatter } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ClipboardCheck } from "lucide-react";

/**
 * Admin aggregate grading queue table (FR-020). Renders pending-grading
 * attempts across all instructors. Each row links to the per-attempt grading
 * page under the dashboard grading route (shared with instructors).
 */
export function AdminGradingTable({ items, total, page, limit, basePath }) {
    const t = useTranslations("Grading");
    const fmt = useFormatter();
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return (
        <div className="space-y-3">
            {items.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <ClipboardCheck className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                    <p className="text-slate-500" dir="auto">{t("queueEmpty")}</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="text-start font-medium px-3 py-2" dir="auto">{t("queueInstructorColumn")}</th>
                                <th className="text-start font-medium px-3 py-2" dir="auto">{t("queueColumnStudent")}</th>
                                <th className="text-start font-medium px-3 py-2" dir="auto">{t("queueColumnQuiz")}</th>
                                <th className="text-start font-medium px-3 py-2" dir="auto">{t("queueColumnCourse")}</th>
                                <th className="text-start font-medium px-3 py-2" dir="auto">{t("queueColumnSubmitted")}</th>
                                <th className="text-start font-medium px-3 py-2" dir="auto">{t("queueColumnPending")}</th>
                                <th className="text-end font-medium px-3 py-2" dir="auto">{t("queueColumnActions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((row) => (
                                <tr key={row.id} className="border-t">
                                    <td className="px-3 py-2" dir="auto">{row.instructorName || row.instructorEmail || "—"}</td>
                                    <td className="px-3 py-2" dir="auto">{row.studentName || row.studentEmail}</td>
                                    <td className="px-3 py-2" dir="auto">{row.quizTitle || "—"}</td>
                                    <td className="px-3 py-2" dir="auto">{row.courseTitle || "—"}</td>
                                    <td className="px-3 py-2 text-slate-600">
                                        {row.submittedAt ? fmt.dateTime(new Date(row.submittedAt), { dateStyle: "medium", timeStyle: "short" }) : "—"}
                                    </td>
                                    <td className="px-3 py-2">
                                        <Badge variant="secondary">{row.pendingGradingCount} {t("pendingCountSuffix")}</Badge>
                                    </td>
                                    <td className="px-3 py-2 text-end">
                                        <Button asChild size="sm" variant="outline">
                                            <Link href={`${basePath}/${row.id}`}>{t("queueGradeAction")}</Link>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-slate-600">
                    <span dir="auto">{t("paginationPageOf", { page, totalPages })}</span>
                    <div className="flex gap-1">
                        <Button asChild size="sm" variant="ghost" disabled={page <= 1}>
                            <Link href={`${basePath}?page=${Math.max(1, page - 1)}`}>{t("paginationPrev")}</Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost" disabled={page >= totalPages}>
                            <Link href={`${basePath}?page=${Math.min(totalPages, page + 1)}`}>{t("paginationNext")}</Link>
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
