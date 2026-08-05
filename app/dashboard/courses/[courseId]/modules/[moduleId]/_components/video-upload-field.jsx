"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, X, CheckCircle2, Video } from "lucide-react";
import { toast } from "sonner";
import { handleActionResponse, toastError, toastSuccess } from "@/lib/toast-helpers";
import { useRouter } from "next/navigation";

export const VideoUploadField = ({ lessonId, initialVideo }) => {
    const router = useRouter();
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [uploadedVideo, setUploadedVideo] = useState(initialVideo || null);
    const [error, setError] = useState('');

    const handleFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('video/')) {
            toastError('Invalid file type', 'Please select a video file (mp4, webm, etc.)');
            return;
        }

        // Validate file size (300MB)
        const maxSize = 300 * 1024 * 1024;
        if (file.size > maxSize) {
            toastError('File too large', `File size must be less than ${maxSize / 1024 / 1024}MB`);
            return;
        }

        setError('');
        setUploading(true);
        setProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('lessonId', lessonId);

            const xhr = new XMLHttpRequest();

            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    setProgress(percentComplete);
                }
            });

            // Handle completion
            xhr.addEventListener('load', () => {
                setUploading(false);
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.ok) {
                            setUploadedVideo({
                                filename: response.data.filename,
                                videoUrl: response.data.videoUrl,
                                size: response.data.size,
                                mimeType: response.data.mimeType
                            });
                            toastSuccess('Video uploaded successfully!', `File: ${response.data.filename}`);
                            router.refresh();
                        } else {
                            const errorMessage = response.message || 'Upload failed';
                            setError(errorMessage);
                            toastError('Upload failed', errorMessage);
                        }
                    } catch (parseError) {
                        const errorMessage = 'Failed to parse server response';
                        setError(errorMessage);
                        toastError('Upload failed', errorMessage);
                    }
                } else {
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        const errorMessage = errorResponse.message || `Upload failed with status ${xhr.status}`;
                        setError(errorMessage);
                        toastError('Upload failed', errorMessage);
                    } catch (parseError) {
                        const errorMessage = `Upload failed with status ${xhr.status}`;
                        setError(errorMessage);
                        toastError('Upload failed', errorMessage);
                    }
                }
                setProgress(0);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            });

            // Handle errors
            xhr.addEventListener('error', () => {
                setUploading(false);
                setProgress(0);
                const errorMessage = 'Network error during upload';
                setError(errorMessage);
                toastError('Upload failed', errorMessage);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            });

            xhr.addEventListener('abort', () => {
                setUploading(false);
                setProgress(0);
                const errorMessage = 'Upload cancelled';
                setError(errorMessage);
                toastError('Upload cancelled', errorMessage);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            });

            // Send request
            xhr.open('POST', '/api/upload/video');
            xhr.send(formData);

        } catch (error) {
            console.error('Upload error:', error);
            setUploading(false);
            setProgress(0);
            const errorMessage = error?.message || 'Failed to upload video. Please try again.';
            setError(errorMessage);
            toastError('Upload failed', errorMessage);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/upload/video?lessonId=${lessonId}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (response.ok && data.ok) {
                setUploadedVideo(null);
                toastSuccess('Video deleted successfully');
                router.refresh();
            } else {
                throw new Error(data.message || 'Failed to delete video');
            }
        } catch (error) {
            console.error('Delete error:', error);
            toastError('Delete failed', error?.message || 'Failed to delete video. Please try again.');
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <div className="space-y-4">
            <div>
                <Label>Video Upload</Label>
                <p className="text-sm text-muted-foreground mt-1">
                    Upload a video file (MP4, WebM). Maximum size: 300MB
                </p>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
            />

            {!uploadedVideo && !uploading && (
                <Button
                    type="button"
                    onClick={handleFileSelect}
                    variant="outline"
                    className="w-full"
                >
                    <Upload className="h-4 w-4 mr-2" />
                    Select Video File
                </Button>
            )}

            {uploading && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span>Uploading...</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} />
                </div>
            )}

            {uploadedVideo && !uploading && (
                <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Video className="h-5 w-5 text-primary" />
                            <div>
                                <p className="font-medium text-sm">{uploadedVideo.filename}</p>
                                <p className="text-xs text-muted-foreground">
                                    {formatFileSize(uploadedVideo.size)}
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
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Video URL: {uploadedVideo.videoUrl}
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

