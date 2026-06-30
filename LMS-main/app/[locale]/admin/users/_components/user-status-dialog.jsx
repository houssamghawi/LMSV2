"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function UserStatusDialog({ open, onOpenChange, user, onConfirm, isPending }) {
    const t = useTranslations("Admin");
    const [selectedStatus, setSelectedStatus] = useState(user?.status || 'active');
    const userName = user ? `${user.firstName} ${user.lastName}` : '';
    const userEmail = user?.email || '';

    const handleConfirm = () => {
        if (selectedStatus !== user.status) {
            onConfirm(selectedStatus);
        } else {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t("changeUserStatus")}</DialogTitle>
                    <DialogDescription>
                        {t("updateStatusFor", { name: userName, email: userEmail })}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <label className="text-sm font-medium mb-2 block">{t("newStatus")}</label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">{t("active")}</SelectItem>
                            <SelectItem value="inactive">{t("inactive")}</SelectItem>
                            <SelectItem value="suspended">{t("suspended")}</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-2">
                        {t("currentStatus")} <strong>{user?.status || 'active'}</strong>
                    </p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                        {t("cancel")}
                    </Button>
                    <Button onClick={handleConfirm} disabled={isPending || selectedStatus === user?.status}>
                        {isPending ? t("updating") : t("updateStatus")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

