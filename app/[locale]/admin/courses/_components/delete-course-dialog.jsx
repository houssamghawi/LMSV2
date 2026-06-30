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

export function DeleteCourseDialog({ open, onOpenChange, course, onConfirm, isPending }) {
    const t = useTranslations("Admin");
    const courseTitle = course?.title || '';

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t("deleteCourseConfirm")}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("deleteCourseWarning")}{" "}
                        <strong dir="auto">{courseTitle}</strong>
                        <br />
                        <br />
                        {t("deleteCourseAffected")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isPending}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isPending ? t("deleting") : t("deleteCourse")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
