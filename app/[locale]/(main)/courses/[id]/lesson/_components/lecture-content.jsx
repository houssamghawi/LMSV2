"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sanitizeHtml } from "@/lib/sanitize-html";

/**
 * Resolve display HTML: file-based extractedHtml first, then legacy description.
 * When docxFilename is set, legacy description is never shown (data-model.md).
 */
function resolveLectureHtml({ extractedHtml, description, docxFilename }) {
    if (docxFilename) {
        if (extractedHtml && String(extractedHtml).trim()) {
            return { html: sanitizeHtml(extractedHtml), isEmpty: false };
        }
        return { html: "", isEmpty: true };
    }

    if (extractedHtml && String(extractedHtml).trim()) {
        return { html: sanitizeHtml(extractedHtml), isEmpty: false };
    }

    if (description && String(description).trim()) {
        const raw = String(description).trim();
        const legacyHtml = raw.includes("<") ? raw : `<p>${raw}</p>`;
        return { html: sanitizeHtml(legacyHtml), isEmpty: false };
    }

    return { html: "", isEmpty: true };
}

/**
 * Student-facing lecture content section (replaces VideoDescription).
 *
 * @param {object} props
 * @param {string | null} [props.extractedHtml]
 * @param {string | null} [props.description]
 * @param {string | null} [props.docxFilename]
 */
export function LectureContent({
    extractedHtml = null,
    description = null,
    docxFilename = null
}) {
    const t = useTranslations("Lesson");
    const { html, isEmpty } = useMemo(
        () => resolveLectureHtml({ extractedHtml, description, docxFilename }),
        [extractedHtml, description, docxFilename]
    );

    return (
        <div className="mt-4">
            <Tabs defaultValue="lecture">
                <TabsList className="bg-transparent p-0 border-b border-border w-full justify-start h-auto rounded-none">
                    <TabsTrigger className="capitalize" value="lecture">
                        {t("lecture")}
                    </TabsTrigger>
                </TabsList>
                <div className="pt-3">
                    <TabsContent value="lecture">
                        {isEmpty ? (
                            <p className="text-sm text-muted-foreground">
                                {t("noLectureContent")}
                            </p>
                        ) : (
                            <div
                                className="lecture-content prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-ul:my-3 prose-ol:my-3 prose-li:my-0.5 prose-img:max-w-full prose-img:h-auto prose-img:rounded-md prose-table:w-full prose-table:border prose-table:border-border prose-th:border prose-th:border-border prose-td:border prose-td:border-border prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2"
                                dir="auto"
                                dangerouslySetInnerHTML={{ __html: html }}
                            />
                        )}
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}

export default LectureContent;
