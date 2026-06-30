"use client";

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/safe-image";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function ProfileImageUpload({ currentImageUrl, userEmail }) {
    const router = useRouter();
    const t = useTranslations('Account');
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [imageUrl, setImageUrl] = useState(currentImageUrl);

    const handleFileSelect = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            toast.error(t('invalidFileType'));
            return;
        }

        // Validate file size (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error(t('fileTooLarge'));
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            toast.error(t('pleaseSelectFile'));
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Simulate progress (since we can't track actual upload progress easily)
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 200);

            const response = await fetch('/api/profile/avatar', {
                method: 'POST',
                body: formData,
            });

            clearInterval(progressInterval);
            setUploadProgress(100);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
                throw new Error(errorData.error || t('uploadFailed'));
            }

            const result = await response.json();
            
            // Update local state
            setImageUrl(result.imageUrl);
            setPreviewUrl(null);
            
            // Clear file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            toast.success(t('profileImageUpdated'));
            
            // Refresh the page to show updated image
            router.refresh();
            
            // Small delay to show completion
            setTimeout(() => {
                setUploadProgress(0);
            }, 500);

        } catch (error) {
            console.error('Upload error:', error);
            toast.error(error?.message || t('uploadFailed'));
            setPreviewUrl(null);
            setUploadProgress(0);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancel = () => {
        setPreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const displayUrl = previewUrl || imageUrl;

    return (
        <div className="space-y-4">
            <div className="relative size-28 mx-auto">
                <SafeImage
                    src={displayUrl}
                    className="rounded-full shadow dark:shadow-gray-800 ring-4 ring-slate-50 dark:ring-slate-800 w-full h-full object-cover"
                    alt={t('profile')}
                    width={112}
                    height={112}
                    fallback="/assets/images/profile.jpg"
                />
                {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                )}
                {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                        <span className="text-white text-sm font-medium">{uploadProgress}%</span>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="avatar-upload"
                    disabled={isUploading}
                />
                
                {!previewUrl ? (
                    <label htmlFor="avatar-upload">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            disabled={isUploading}
                            asChild
                        >
                            <span className="cursor-pointer">
                                <Upload className="h-4 w-4 me-2 inline" />
                                {isUploading ? t('uploading') : t('changePhoto')}
                            </span>
                        </Button>
                    </label>
                ) : (
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="flex-1"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                    {t('uploading')}
                                </>
                            ) : (
                                t('upload')
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isUploading}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
                {t('imageFormatHint')}
            </p>
        </div>
    );
}

