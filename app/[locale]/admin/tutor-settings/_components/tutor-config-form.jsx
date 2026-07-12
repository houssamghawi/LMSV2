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
import { Textarea } from "@/components/ui/textarea";
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

const formSchema = z
    .object({
        outOfContextMessageEn: z.string().min(10).max(500),
        outOfContextMessageAr: z.string().min(10).max(500),
        enabled: z.boolean(),
        rateLimitPerHour: z.number().int().min(1).max(100),
        relevanceThreshold: z.number().min(0.5).max(0.95),
        maxContextChunks: z.number().int().min(1).max(10)
    })
    .strict();

/**
 * Admin AI tutor configuration form.
 */
export function TutorConfigForm({ initialConfig }) {
    const t = useTranslations("Tutor");
    const [submitting, setSubmitting] = useState(false);

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            outOfContextMessageEn:
                initialConfig?.outOfContextMessage?.en ??
                t("defaultOutOfContextEn"),
            outOfContextMessageAr:
                initialConfig?.outOfContextMessage?.ar ??
                t("defaultOutOfContextAr"),
            enabled: initialConfig?.enabled ?? true,
            rateLimitPerHour: initialConfig?.rateLimitPerHour ?? 20,
            relevanceThreshold: initialConfig?.relevanceThreshold ?? 0.7,
            maxContextChunks: initialConfig?.maxContextChunks ?? 5
        }
    });

    async function onSubmit(values) {
        setSubmitting(true);
        try {
            const res = await fetch("/api/tutor/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    courseId: null,
                    outOfContextMessage: {
                        en: values.outOfContextMessageEn,
                        ar: values.outOfContextMessageAr
                    },
                    enabled: values.enabled,
                    rateLimitPerHour: values.rateLimitPerHour,
                    relevanceThreshold: values.relevanceThreshold,
                    maxContextChunks: values.maxContextChunks
                })
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || t("settingsSaveFailed"));
            }

            toast.success(t("settingsSaved"));
        } catch (error) {
            toast.error(error?.message || t("settingsSaveFailed"));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
                <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                                <Checkbox
                                    checked={!!field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>{t("settingsEnabled")}</FormLabel>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="outOfContextMessageEn"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("settingsOutOfContextEn")}</FormLabel>
                            <FormControl>
                                <Textarea rows={4} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="outOfContextMessageAr"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("settingsOutOfContextAr")}</FormLabel>
                            <FormControl>
                                <Textarea rows={4} dir="rtl" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="rateLimitPerHour"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("settingsRateLimit")}</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    {...field}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="relevanceThreshold"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("settingsRelevanceThreshold")}</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    min={0.5}
                                    max={0.95}
                                    step={0.05}
                                    {...field}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                            </FormControl>
                            <FormDescription>
                                {t("settingsRelevanceThresholdHint")}
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="maxContextChunks"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t("settingsMaxContextChunks")}</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    min={1}
                                    max={10}
                                    {...field}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" disabled={submitting}>
                    {submitting ? (
                        <Loader2 className="w-4 h-4 me-2 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4 me-2" />
                    )}
                    {t("settingsSave")}
                </Button>
            </form>
        </Form>
    );
}
