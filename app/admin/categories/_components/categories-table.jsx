"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Edit, Trash2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CategoriesTable({ categories: initialCategories }) {
    const [searchTerm, setSearchTerm] = useState("");
    
    const filteredCategories = initialCategories.filter(category => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            category.title?.toLowerCase().includes(search) ||
            category.description?.toLowerCase().includes(search)
        );
    });

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex-1 relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search categories..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Button asChild>
                    <Link href="/dashboard/courses/add">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Category
                    </Link>
                </Button>
            </div>

            {/* Table */}
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Thumbnail</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCategories.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                    {searchTerm ? "No categories found" : "No categories available"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCategories.map((category) => (
                                <TableRow key={category.id}>
                                    <TableCell className="font-medium">
                                        {category.title}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm text-gray-600 line-clamp-2 max-w-md">
                                            {category.description || "No description"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="relative w-16 h-16 rounded overflow-hidden">
                                            <Image
                                                src={`/assets/images/categories/${category.thumbnail}`}
                                                alt={category.title}
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/categories/${category.id}`}>
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        View Courses
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-red-600"
                                                    onClick={() => {
                                                        toast.info("Delete functionality coming soon");
                                                    }}
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

            {filteredCategories.length > 0 && (
                <div className="text-sm text-gray-600">
                    Showing {filteredCategories.length} of {initialCategories.length} categories
                </div>
            )}
        </div>
    );
}

