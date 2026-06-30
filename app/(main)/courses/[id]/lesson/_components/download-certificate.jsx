"use client"
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Lock } from "lucide-react";
import { handleActionResponse, toastError, toastSuccess } from "@/lib/toast-helpers";

export const DownloadCertificate = ({ courseId, totalProgress }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const isComplete = totalProgress >= 100;

    async function handleCertificateDownload() {
        if (!isComplete) {
            toastError('Course Not Complete', 'You must complete 100% of the course to download the certificate.');
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
                    toastError('Access Denied', errorData.message || 'Course must be 100% complete to download certificate.');
                } else if (response.status === 401) {
                    toastError('Authentication Required', 'Please log in to download certificates.');
                } else if (response.status === 404) {
                    toastError('Not Found', 'Course or certificate not found.');
                } else {
                    toastError('Download Failed', errorData.message || 'Failed to download certificate. Please try again.');
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

            toastSuccess('Certificate Downloaded', 'Your certificate has been downloaded successfully.');
            
        } catch (error) {
            console.error('Certificate download error:', error);
            toastError('Download Failed', error?.message || 'Failed to download certificate. Please try again.');
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
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                    </>
                ) : !isComplete ? (
                    <>
                        <Lock className="h-4 w-4 mr-2" />
                        Complete Course to Download
                    </>
                ) : (
                    <>
                        <Download className="h-4 w-4 mr-2" />
                        Download Certificate
                    </>
                )}
            </Button>
            {!isComplete && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                    Progress: {Math.round(totalProgress)}% - Complete all modules to download
                </p>
            )}
        </div>
    );
}
