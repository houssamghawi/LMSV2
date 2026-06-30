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

export function UserRoleDialog({ open, onOpenChange, user, onConfirm, isPending }) {
    const [selectedRole, setSelectedRole] = useState(user?.role || 'student');

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
                    <DialogTitle>Change User Role</DialogTitle>
                    <DialogDescription>
                        Change the role for {user?.firstName} {user?.lastName} ({user?.email})
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <label className="text-sm font-medium mb-2 block">New Role</label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="instructor">Instructor</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-2">
                        Current role: <strong>{user?.role}</strong>
                    </p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={isPending || selectedRole === user?.role}>
                        {isPending ? 'Updating...' : 'Update Role'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

