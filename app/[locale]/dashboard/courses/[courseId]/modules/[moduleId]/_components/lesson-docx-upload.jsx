"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, X, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { toastError, toastSuccess } from "@/lib/toast-helpers";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DOCX_MIME_TYPE, MAX_LESSON_DOCX_SIZE } from "@/lib/constants";

export const LessonDocxUpload = ({ lessonId, initialDocx, onUploaded }) => {
    const t = useTranslations("ChapterEdit");
    const router = useRouter();
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [uploadedDocx, setUploadedDocx] = useState(
        initialDocx?.docxFilename || initialDocx?.originalName
            ? {
                  filename: initialDocx.docxFilename,
                  originalName: initialDocx.originalName || initialDocx.docxFilename,
                  size: initialDocx.size,
                  embeddingStatus: initialDocx.embeddingStatus
              }
            : null
    );
    const [error, setError] = useState("");

    const handleFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const isDocx =
            file.type === DOCX_MIME_TYPE || file.name.toLowerCase().endsWith(".docx");
        if (!isDocx) {
            toastError(t("invalidDocxFileType"), t("selectDocxFile"));
            return;
        }

        if (file.size > MAX_LESSON_DOCX_SIZE) {
            toastError(t("fileTooLarge"), t("docxFileSizeLimit"));
            return;
        }

        setError("");
        setUploading(true);
        setProgress(0);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("lessonId", lessonId);

            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) {
                    setProgress((e.loaded / e.total) * 100);
                }
            });

            xhr.addEventListener("load", () => {
                setUploading(false);
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.ok) {
                            setUploadedDocx({
                                filename: response.data.filename,
                                originalName: response.data.originalName,
                                size: response.data.size,
                                embeddingStatus: response.data.embeddingStatus
                            });
                            toastSuccess(
                                t("docxUploaded"),
                                response.data.originalName
                            );
                            onUploaded?.();
                            router.refresh();
                        } else {
                            const errorMessage = response.message || t("uploadFailed");
                            setError(errorMessage);
                            toastError(t("uploadFailed"), errorMessage);
                        }
                    } catch {
                        const errorMessage = t("uploadFailed");
                        setError(errorMessage);
                        toastError(t("uploadFailed"), errorMessage);
                    }
                } else {
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        const errorMessage = errorResponse.message || t("uploadFailed");
                        setError(errorMessage);
                        toastError(t("uploadFailed"), errorMessage);
                    } catch {
                        const errorMessage = t("uploadFailed");
                        setError(errorMessage);
                        toastError(t("uploadFailed"), errorMessage);
                    }
                }
                setProgress(0);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            });

            xhr.addEventListener("error", () => {
                setUploading(false);
                setProgress(0);
                const errorMessage = t("uploadFailed");
                setError(errorMessage);
                toastError(t("uploadFailed"), errorMessage);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            });

            xhr.open("POST", "/api/upload/lesson-docx");
            xhr.send(formData);
        } catch (uploadError) {
            console.error("Upload error:", uploadError);
            setUploading(false);
            setProgress(0);
            const errorMessage = uploadError?.message || t("somethingWentWrong");
            setError(errorMessage);
            toastError(t("uploadFailed"), errorMessage);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDelete = async () => {
        if (!confirm(t("deleteDocxConfirm"))) {
            return;
        }

        try {
            const response = await fetch(`/api/upload/lesson-docx?lessonId=${lessonId}`, {
                method: "DELETE"
            });
            const data = await response.json();

            if (response.ok && data.ok) {
                setUploadedDocx(null);
                toastSuccess(t("docxDeleted"));
                onUploaded?.();
                router.refresh();
            } else {
                throw new Error(data.message || t("failedDeleteDocx"));
            }
        } catch (deleteError) {
            console.error("Delete error:", deleteError);
            toastError(t("uploadFailed"), deleteError?.message || t("failedDeleteDocx"));
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
    };

    return (
        <div className="space-y-4 mt-6 border bg-slate-100 rounded-md p-4">
            <div>
                <Label>{t("docxUploadLabel")}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                    {t("docxUploadHint")}
                </p>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
            />

            {!uploading && (
                <Button
                    type="button"
                    onClick={handleFileSelect}
                    variant="outline"
                    className="w-full"
                >
                    <Upload className="h-4 w-4 me-2" />
                    {uploadedDocx ? t("replaceDocxFileBtn") : t("selectDocxFileBtn")}
                </Button>
            )}

            {uploading && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span>{t("uploading")}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} />
                </div>
            )}

            {uploadedDocx && !uploading && (
                <div className="border rounded-lg p-4 space-y-3 bg-background">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            <div>
                                <p className="font-medium text-sm">
                                    {uploadedDocx.originalName || uploadedDocx.filename}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {formatFileSize(uploadedDocx.size)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleDelete}
                                aria-label={t("delete")}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                    {error}
                </div>
            )}
        </div>
    );
};
