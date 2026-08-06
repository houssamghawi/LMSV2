"use client"
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Lock } from "lucide-react";
import { handleActionResponse, toastError, toastSuccess } from "@/lib/toast-helpers";

export const DownloadCertificate = ({ courseId, totalProgress }) => {
  const t = useTranslations("Lesson");
  const [isDownloading, setIsDownloading] = useState(false);
  const isComplete = totalProgress >= 100;

  async function handleCertificateDownload() {
    if (!isComplete) {
      toastError(t("toastCourseNotComplete"), t("toastMustComplete100"));
      return;
    }

        setIsDownloading(true);

        try {
            const response = await fetch(`/api/certificates/${courseId}`, {
                method: 'GET',
            });

            // Handle error responses (JSON)
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ 
                    message: `Failed to download certificate (${response.status})` 
                }));
                
                if (response.status === 403) {
                  toastError(t("toastAccessDenied"), errorData.message || t("toastCourseCompleteRequired"));
                } else if (response.status === 401) {
                  toastError(t("toastAuthRequired"), t("toastAuthRequiredDesc"));
                } else if (response.status === 404) {
                  toastError(t("toastNotFound"), errorData.message || t("toastDownloadFailedDesc"));
                } else {
                  toastError(t("toastDownloadFailed"), errorData.message || t("toastDownloadFailedDesc"));
                }
                setIsDownloading(false);
                return;
            }

            // Handle successful PDF response
            const blob = await response.blob();
            
            // Verify it's a PDF
            if (blob.type !== 'application/pdf') {
                throw new Error('Invalid file type received');
            }

            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Get filename from Content-Disposition header or use default
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'certificate.pdf';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            toastSuccess(t("toastCertificateDownloaded"), t("toastCertificateDownloadedDesc"));
            
        } catch (error) {
            console.error('Certificate download error:', error);
            toastError(t("toastDownloadFailed"), error?.message || t("toastDownloadFailedDesc"));
        } finally {
            setIsDownloading(false);
        }
    }

    return (
        <div className="w-full">
            <Button
                onClick={handleCertificateDownload}
                disabled={!isComplete || isDownloading}
                className="w-full mt-6"
                variant={isComplete ? "default" : "secondary"}
            >
                {isDownloading ? (
                    <>
                        <Loader2 className="h-4 w-4 me-2 animate-spin" />
                        {t("generating")}
                    </>
                ) : !isComplete ? (
                    <>
                        <Lock className="h-4 w-4 me-2" />
                        {t("completeCourseToDownload")}
                    </>
                ) : (
                    <>
                        <Download className="h-4 w-4 me-2" />
                        {t("downloadCertificate")}
                    </>
                )}
            </Button>
            {!isComplete && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                    {t("progressCompleteAll", { progress: Math.round(totalProgress) })}
                </p>
            )}
        </div>
    );
}
