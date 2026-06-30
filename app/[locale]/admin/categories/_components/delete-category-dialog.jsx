"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslations } from "next-intl";

export function DeleteCategoryDialog({ open, onOpenChange, category, onConfirm, isPending }) {
    const t = useTranslations("Admin");
    const categoryTitle = category?.title || '';

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t("deleteCategoryConfirm")}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("deleteCategoryWarning")}{" "}
                        <strong dir="auto">{categoryTitle}</strong>
                        <br />
                        <br />
                        {t("deleteCategoryAffected")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isPending}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isPending ? t("deleting") : t("deleteCategory")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
