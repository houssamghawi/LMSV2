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

export function UserRoleDialog({ open, onOpenChange, user, onConfirm, isPending }) {
    const t = useTranslations("Admin");
    const [selectedRole, setSelectedRole] = useState(user?.role || 'student');
    const userName = user ? `${user.firstName} ${user.lastName}` : '';
    const userEmail = user?.email || '';

    const handleConfirm = () => {
        if (selectedRole !== user.role) {
            onConfirm(selectedRole);
        } else {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t("changeUserRole")}</DialogTitle>
                    <DialogDescription>
                        {t("changeRoleFor", { name: userName, email: userEmail })}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <label className="text-sm font-medium mb-2 block">{t("newRole")}</label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="student">{t("student")}</SelectItem>
                            <SelectItem value="instructor">{t("instructor")}</SelectItem>
                            <SelectItem value="admin">{t("admin")}</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-2">
                        {t("currentRole")} <strong>{user?.role}</strong>
                    </p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                        {t("cancel")}
                    </Button>
                    <Button onClick={handleConfirm} disabled={isPending || selectedRole === user?.role}>
                        {isPending ? t("updating") : t("updateRole")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

