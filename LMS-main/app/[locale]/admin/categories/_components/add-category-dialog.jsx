"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import { adminCreateCategory } from "@/app/actions/admin-categories";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { UploadDropzone } from "@/components/file-upload";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

export function AddCategoryDialog({ open, onOpenChange }) {
    const t = useTranslations("Admin");
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [files, setFiles] = useState([]);
    const [uploadedThumbnail, setUploadedThumbnail] = useState("");
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        thumbnail: ""
    });

    // Handle file upload
    useEffect(() => {
        if (!files?.length || !files?.[0]) return;

        async function uploadFile() {
            setIsUploading(true);
            try {
                const formData = new FormData();
                formData.append("files", files[0]);
                formData.append("destination", "./public/assets/images/categories");

                const response = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                const result = await response.json();

                if (!response.ok) {
                    toast.error(result.error || t("uploadFailed"));
                    setFiles([]);
                    return;
                }

                const filename = result.filename;
                setUploadedThumbnail(filename);
                setFormData(prev => ({ ...prev, thumbnail: filename }));
                toast.success(t("imageUploaded"));
                setFiles([]);
            } catch (e) {
                toast.error(e?.message || t("somethingWentWrong"));
                setFiles([]);
            } finally {
                setIsUploading(false);
            }
        }

        uploadFile();
    }, [files, t]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.title.trim()) {
            toast.error(t("categoryTitleRequired"));
            return;
        }

        setIsPending(true);
        try {
            await adminCreateCategory(formData);
            toast.success(t("categoryCreated"));
            setFormData({ title: "", description: "", thumbnail: "" });
            setUploadedThumbnail("");
            onOpenChange(false);
            router.refresh();
        } catch (error) {
            console.error('Create category error:', error);
            toast.error(error?.message || t("failedCreateCategory"));
        } finally {
            setIsPending(false);
        }
    };

    const handleDialogClose = (isOpen) => {
        if (!isOpen) {
            // Reset form when closing
            setFormData({ title: "", description: "", thumbnail: "" });
            setUploadedThumbnail("");
            setFiles([]);
        }
        onOpenChange(isOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t("addCategory")}</DialogTitle>
                    <DialogDescription>
                        {t("addCategoryDescription")}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">{t("categoryTitle")}</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder={t("categoryTitlePlaceholder")}
                                disabled={isPending || isUploading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">{t("categoryDescription")}</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder={t("categoryDescriptionPlaceholder")}
                                disabled={isPending || isUploading}
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t("categoryThumbnail")}</Label>
                            {!uploadedThumbnail ? (
                                <UploadDropzone
                                    onUpload={(incoming) => setFiles(Array.isArray(incoming) ? incoming : [incoming])}
                                    disabled={isPending || isUploading}
                                    maxSizeMB={5}
                                />
                            ) : (
                                <div className="space-y-2">
                                    <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                                        <Image
                                            src={`/assets/images/categories/${uploadedThumbnail}`}
                                            alt={t("categoryThumbnail")}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setUploadedThumbnail("");
                                            setFormData(prev => ({ ...prev, thumbnail: "" }));
                                        }}
                                        disabled={isPending}
                                    >
                                        {t("changeImage")}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleDialogClose(false)}
                            disabled={isPending || isUploading}
                        >
                            {t("cancel")}
                        </Button>
                        <Button type="submit" disabled={isPending || isUploading}>
                            {isPending ? t("creating") : t("create")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
