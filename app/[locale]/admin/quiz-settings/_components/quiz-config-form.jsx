"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription
} from "@/components/ui/form";
import { adminUpdateQuizConfig } from "@/app/actions/admin";

// Client-side schema for the form. Mirrors the server-side
// `adminQuizConfigSchema` bounds but edits the document size in MB rather than
// bytes. The submit handler converts MB → bytes and dispatches to the server
// action, which re-validates with `adminQuizConfigSchema` (.strict()).
const formSchema = z.object({
    dailyQuotaPerInstructor: z.number().int().min(1).max(1000),
    maxDocumentSizeMB: z.number().int().min(1).max(50),
    maxQuestionsPerGeneration: z.number().int().min(1).max(50),
    sourceRetentionEnabled: z.boolean(),
    sourceRetentionDays: z.number().int().min(1).max(365).optional()
}).strict();

const MB = 1024 * 1024;

/**
 * Admin quiz generation settings form (FR-012, contracts §10).
 *
 * Fields:
 *   - dailyQuotaPerInstructor (1..1000)
 *   - maxDocumentSizeBytes (1MB..50MB, shown in MB)
 *   - maxQuestionsPerGeneration (1..50)
 *   - sourceRetentionEnabled (bool)
 *   - sourceRetentionDays (1..365, shown only when retention enabled)
 *
 * Submits via the `adminUpdateQuizConfig` server action. On success, calls
 * `onSaved` so the parent page can refresh the displayed config.
 */
export function QuizConfigForm({ initialConfig, onSaved }) {
    const t = useTranslations("AdminQuizSettings");
    const [submitting, setSubmitting] = useState(false);

    const defaults = {
        dailyQuotaPerInstructor: initialConfig?.dailyQuotaPerInstructor ?? 20,
        maxDocumentSizeBytes: initialConfig?.maxDocumentSizeBytes ?? 10 * MB,
        maxQuestionsPerGeneration: initialConfig?.maxQuestionsPerGeneration ?? 30,
        sourceRetentionEnabled: initialConfig?.sourceRetentionEnabled ?? false,
        sourceRetentionDays: initialConfig?.sourceRetentionDays ?? 30
    };

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            ...defaults,
            // The form edits the size in MB; convert to bytes on submit.
            maxDocumentSizeMB: Math.round(defaults.maxDocumentSizeBytes / MB)
        }
    });

    const retentionEnabled = form.watch("sourceRetentionEnabled");

    async function onSubmit(values) {
        setSubmitting(true);
        try {
            const payload = {
                dailyQuotaPerInstructor: Number(values.dailyQuotaPerInstructor),
                maxDocumentSizeBytes: Math.round(Number(values.maxDocumentSizeMB) * MB),
                maxQuestionsPerGeneration: Number(values.maxQuestionsPerGeneration),
                sourceRetentionEnabled: !!values.sourceRetentionEnabled,
                sourceRetentionDays: values.sourceRetentionEnabled
                    ? Number(values.sourceRetentionDays ?? 30)
                    : undefined
            };
            const result = await adminUpdateQuizConfig(payload);
            if (result?.ok) {
                toast.success(t("saveSuccessToast"));
                onSaved?.(result.config);
            } else {
                toast.error(result?.error || t("saveErrorToast"));
            }
        } catch (error) {
            toast.error(error?.message || t("saveErrorToast"));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
                <FormField
                    control={form.control}
                    name="dailyQuotaPerInstructor"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("fieldDailyQuota")}</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    min={1}
                                    max={1000}
                                    aria-describedby="quota-hint"
                                    {...field}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                            </FormControl>
                            <FormDescription id="quota-hint">{t("fieldDailyQuotaHint")}</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="maxDocumentSizeMB"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("fieldMaxDocSize")}</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    min={1}
                                    max={50}
                                    aria-describedby="docsize-hint"
                                    {...field}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                            </FormControl>
                            <FormDescription id="docsize-hint">{t("fieldMaxDocSizeHint")}</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="maxQuestionsPerGeneration"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("fieldMaxQuestions")}</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    min={1}
                                    max={50}
                                    aria-describedby="maxq-hint"
                                    {...field}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                            </FormControl>
                            <FormDescription id="maxq-hint">{t("fieldMaxQuestionsHint")}</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="sourceRetentionEnabled"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                                <Checkbox
                                    checked={!!field.value}
                                    onCheckedChange={field.onChange}
                                    aria-describedby="retention-hint"
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>{t("fieldRetentionEnabled")}</FormLabel>
                                <FormDescription id="retention-hint">{t("fieldRetentionEnabledHint")}</FormDescription>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {retentionEnabled && (
                    <FormField
                        control={form.control}
                        name="sourceRetentionDays"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t("fieldRetentionDays")}</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={365}
                                        aria-describedby="retention-days-hint"
                                        {...field}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                    />
                                </FormControl>
                                <FormDescription id="retention-days-hint">{t("fieldRetentionDaysHint")}</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
                    {t("saveButton")}
                </Button>
            </form>
        </Form>
    );
}
