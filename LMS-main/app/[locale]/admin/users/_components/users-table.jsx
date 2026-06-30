"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Search, Edit, Trash2, Shield, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
    adminUpdateUserRole,
    adminUpdateUserStatus,
    adminDeleteUser,
    adminBulkAction
} from "@/app/actions/admin";
import { UserRoleDialog } from "./user-role-dialog";
import { UserStatusDialog } from "./user-status-dialog";
import { DeleteUserDialog } from "./delete-user-dialog";

export default function UsersTable({ initialData }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const t = useTranslations("Admin");
    
    const [selectedUser, setSelectedUser] = useState(null);
    const [roleDialogOpen, setRoleDialogOpen] = useState(false);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState([]);

    // Ensure stable data structure
    const users = Array.isArray(initialData?.users) ? initialData.users : [];
    const pagination = initialData?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };
    const error = initialData?.error;

    const handleSearch = (value) => {
        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set('search', value);
        } else {
            params.delete('search');
        }
        params.set('page', '1');
        router.push(`/admin/users?${params.toString()}`);
    };

    const handleFilter = (key, value) => {
        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        params.set('page', '1');
        router.push(`/admin/users?${params.toString()}`);
    };

    const handleRoleChange = async (userId, newRole) => {
        startTransition(async () => {
            try {
                await adminUpdateUserRole(userId, newRole);
                toast.success(t("userRoleUpdated", { role: newRole }));
                router.refresh();
                setRoleDialogOpen(false);
            } catch (error) {
                toast.error(error.message || t("failedUpdateRole"));
            }
        });
    };

    const handleStatusChange = async (userId, newStatus) => {
        startTransition(async () => {
            try {
                await adminUpdateUserStatus(userId, newStatus);
                toast.success(t("userStatusUpdated", { status: newStatus }));
                router.refresh();
                setStatusDialogOpen(false);
            } catch (error) {
                toast.error(error.message || t("failedUpdateStatus"));
            }
        });
    };

    const handleDelete = async (userId) => {
        startTransition(async () => {
            try {
                await adminDeleteUser(userId);
                toast.success(t("userDeleted"));
                router.refresh();
                setDeleteDialogOpen(false);
            } catch (error) {
                toast.error(error.message || t("failedDeleteUser"));
            }
        });
    };

    const handleBulkAction = async (action, options = {}) => {
        if (selectedUsers.length === 0) {
            toast.error(t("selectOneUser"));
            return;
        }

        startTransition(async () => {
            try {
                await adminBulkAction(selectedUsers, action, options);
                toast.success(t("bulkActionCompleted", { action }));
                setSelectedUsers([]);
                router.refresh();
            } catch (error) {
                toast.error(error.message || t("failedBulkAction"));
            }
        });
    };

    const getStatusBadge = (status) => {
        const variants = {
            active: 'default',
            inactive: 'secondary',
            suspended: 'destructive'
        };
        const label = status === 'active' ? t("active") : status === 'inactive' ? t("inactive") : status === 'suspended' ? t("suspended") : status;
        return <Badge variant={variants[status] || 'default'}>{label}</Badge>;
    };

    const getRoleBadge = (role) => {
        const colors = {
            admin: 'bg-red-100 text-red-800',
            instructor: 'bg-blue-100 text-blue-800',
            student: 'bg-green-100 text-green-800'
        };
        const label = role === 'admin' ? t("admin") : role === 'instructor' ? t("instructor") : role === 'student' ? t("student") : role;
        return (
            <Badge className={colors[role] || ''}>
                {label}
            </Badge>
        );
    };

    return (
        <div className="space-y-4">
            {/* Error Message */}
            {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                    Error: {error}
                </div>
            )}
            
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder={t("searchUsersPlaceholder")}
                        defaultValue={searchParams.get('search') || ''}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="ps-10"
                    />
                </div>
                <Select
                    value={searchParams.get('role') || 'all'}
                    onValueChange={(value) => handleFilter('role', value === 'all' ? '' : value)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t("filterByRole")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t("allRoles")}</SelectItem>
                        <SelectItem value="admin">{t("admin")}</SelectItem>
                        <SelectItem value="instructor">{t("instructor")}</SelectItem>
                        <SelectItem value="student">{t("student")}</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={searchParams.get('status') || 'all'}
                    onValueChange={(value) => handleFilter('status', value === 'all' ? '' : value)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t("filterByStatus")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t("allStatus")}</SelectItem>
                        <SelectItem value="active">{t("active")}</SelectItem>
                        <SelectItem value="inactive">{t("inactive")}</SelectItem>
                        <SelectItem value="suspended">{t("suspended")}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Bulk Actions */}
            {selectedUsers.length > 0 && (
                <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium">
                        {t("usersSelected", { n: selectedUsers.length })}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction('activate', { status: 'active' })}
                        disabled={isPending}
                    >
                        <UserCheck className="h-4 w-4 me-2" />
                        {t("activate")}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction('deactivate', { status: 'inactive' })}
                        disabled={isPending}
                    >
                        <UserX className="h-4 w-4 me-2" />
                        {t("deactivate")}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedUsers([])}
                    >
                        {t("clear")}
                    </Button>
                </div>
            )}

            {/* Table */}
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <input
                                    type="checkbox"
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedUsers(users.map(u => u.id));
                                        } else {
                                            setSelectedUsers([]);
                                        }
                                    }}
                                />
                            </TableHead>
                            <TableHead>{t("name")}</TableHead>
                            <TableHead>{t("email")}</TableHead>
                            <TableHead>{t("role")}</TableHead>
                            <TableHead>{t("status")}</TableHead>
                            <TableHead>{t("created")}</TableHead>
                            <TableHead className="text-end">{t("actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                    {t("noUsersFound")}
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            checked={selectedUsers.includes(user.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedUsers([...selectedUsers, user.id]);
                                                } else {
                                                    setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                                }
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium" dir="auto">
                                        {user.firstName} {user.lastName}
                                    </TableCell>
                                    <TableCell dir="auto">{user.email}</TableCell>
                                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                                    <TableCell>{getStatusBadge(user.status || 'active')}</TableCell>
                                    <TableCell>
                                        {user.createdAt 
                                            ? new Date(user.createdAt).toLocaleDateString()
                                            : 'N/A'
                                        }
                                    </TableCell>
                                    <TableCell className="text-end">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setRoleDialogOpen(true);
                                                    }}
                                                >
                                                    <Shield className="h-4 w-4 me-2" />
                                                    {t("changeRole")}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setStatusDialogOpen(true);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4 me-2" />
                                                    {t("changeStatus")}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setDeleteDialogOpen(true);
                                                    }}
                                                    className="text-red-600"
                                                >
                                                    <Trash2 className="h-4 w-4 me-2" />
                                                    {t("delete")}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        {t("showingUsers", {
                            from: ((pagination.page - 1) * pagination.limit) + 1,
                            to: Math.min(pagination.page * pagination.limit, pagination.total),
                            total: pagination.total
                        })}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const params = new URLSearchParams(searchParams);
                                params.set('page', String(Math.max(1, pagination.page - 1)));
                                router.push(`/admin/users?${params.toString()}`);
                            }}
                            disabled={pagination.page === 1}
                        >
                            {t("previous")}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const params = new URLSearchParams(searchParams);
                                params.set('page', String(Math.min(pagination.totalPages, pagination.page + 1)));
                                router.push(`/admin/users?${params.toString()}`);
                            }}
                            disabled={pagination.page === pagination.totalPages}
                        >
                            {t("next")}
                        </Button>
                    </div>
                </div>
            )}

            {/* Dialogs */}
            {selectedUser && (
                <>
                    <UserRoleDialog
                        open={roleDialogOpen}
                        onOpenChange={setRoleDialogOpen}
                        user={selectedUser}
                        onConfirm={(newRole) => handleRoleChange(selectedUser.id, newRole)}
                        isPending={isPending}
                    />
                    <UserStatusDialog
                        open={statusDialogOpen}
                        onOpenChange={setStatusDialogOpen}
                        user={selectedUser}
                        onConfirm={(newStatus) => handleStatusChange(selectedUser.id, newStatus)}
                        isPending={isPending}
                    />
                    <DeleteUserDialog
                        open={deleteDialogOpen}
                        onOpenChange={setDeleteDialogOpen}
                        user={selectedUser}
                        onConfirm={() => handleDelete(selectedUser.id)}
                        isPending={isPending}
                    />
                </>
            )}
        </div>
    );
}

