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
import { MoreHorizontal, Search, Edit, Trash2, Shield, UserCheck, UserX, RefreshCw } from "lucide-react";
import { toast } from "sonner";
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
                toast.success(`User role updated to ${newRole}`);
                router.refresh();
                setRoleDialogOpen(false);
            } catch (error) {
                toast.error(error.message || 'Failed to update role');
            }
        });
    };

    const handleStatusChange = async (userId, newStatus) => {
        startTransition(async () => {
            try {
                await adminUpdateUserStatus(userId, newStatus);
                toast.success(`User status updated to ${newStatus}`);
                router.refresh();
                setStatusDialogOpen(false);
            } catch (error) {
                toast.error(error.message || 'Failed to update status');
            }
        });
    };

    const handleDelete = async (userId) => {
        startTransition(async () => {
            try {
                await adminDeleteUser(userId);
                toast.success('User deleted successfully');
                router.refresh();
                setDeleteDialogOpen(false);
            } catch (error) {
                toast.error(error.message || 'Failed to delete user');
            }
        });
    };

    const handleBulkAction = async (action, options = {}) => {
        if (selectedUsers.length === 0) {
            toast.error('Please select at least one user');
            return;
        }

        startTransition(async () => {
            try {
                await adminBulkAction(selectedUsers, action, options);
                toast.success(`Bulk action completed: ${action}`);
                setSelectedUsers([]);
                router.refresh();
            } catch (error) {
                toast.error(error.message || 'Failed to perform bulk action');
            }
        });
    };

    const getStatusBadge = (status) => {
        const variants = {
            active: 'default',
            inactive: 'secondary',
            suspended: 'destructive'
        };
        return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
    };

    const getRoleBadge = (role) => {
        const colors = {
            admin: 'bg-red-100 text-red-800',
            instructor: 'bg-blue-100 text-blue-800',
            student: 'bg-green-100 text-green-800'
        };
        return (
            <Badge className={colors[role] || ''}>
                {role}
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search users by name or email..."
                        defaultValue={searchParams.get('search') || ''}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select
                    value={searchParams.get('role') || 'all'}
                    onValueChange={(value) => handleFilter('role', value === 'all' ? '' : value)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="instructor">Instructor</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={searchParams.get('status') || 'all'}
                    onValueChange={(value) => handleFilter('status', value === 'all' ? '' : value)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Bulk Actions */}
            {selectedUsers.length > 0 && (
                <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium">
                        {selectedUsers.length} user(s) selected
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction('activate', { status: 'active' })}
                        disabled={isPending}
                    >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Activate
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBulkAction('deactivate', { status: 'inactive' })}
                        disabled={isPending}
                    >
                        <UserX className="h-4 w-4 mr-2" />
                        Deactivate
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedUsers([])}
                    >
                        Clear
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
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                    No users found
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
                                    <TableCell className="font-medium">
                                        {user.firstName} {user.lastName}
                                    </TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                                    <TableCell>{getStatusBadge(user.status || 'active')}</TableCell>
                                    <TableCell>
                                        {user.createdAt 
                                            ? new Date(user.createdAt).toLocaleDateString()
                                            : 'N/A'
                                        }
                                    </TableCell>
                                    <TableCell className="text-right">
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
                                                    <Shield className="h-4 w-4 mr-2" />
                                                    Change Role
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setStatusDialogOpen(true);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Change Status
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setDeleteDialogOpen(true);
                                                    }}
                                                    className="text-red-600"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
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
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                        {pagination.total} users
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
                            Previous
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
                            Next
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

