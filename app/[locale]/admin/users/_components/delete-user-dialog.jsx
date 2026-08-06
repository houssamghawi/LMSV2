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

export function DeleteUserDialog({ open, onOpenChange, user, onConfirm, isPending }) {
    const t = useTranslations("Admin");
    const userName = user ? `${user.firstName} ${user.lastName}` : '';
    const userEmail = user?.email || '';

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t("deleteUserConfirm")}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("deleteUserWarning")}{" "}
                        <strong>{userName}</strong> ({userEmail}).
                        <br />
                        <br />
                        {t("deleteUserAffected")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isPending}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isPending ? t("deleting") : t("deleteUser")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

