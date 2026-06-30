"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Eye, Edit, Trash2, CheckCircle2, XCircle, Search } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import Image from "next/image";

export default function CoursesTable({ courses: initialCourses }) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    
    // Filter courses based on search
    const filteredCourses = initialCourses.filter(course => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            course.title?.toLowerCase().includes(search) ||
            course.subtitle?.toLowerCase().includes(search) ||
            course.category?.title?.toLowerCase().includes(search) ||
            course.instructor?.firstName?.toLowerCase().includes(search) ||
            course.instructor?.lastName?.toLowerCase().includes(search)
        );
    });

    const getStatusBadge = (active) => {
        return active ? (
            <Badge className="bg-green-100 text-green-800">Published</Badge>
        ) : (
            <Badge variant="secondary">Draft</Badge>
        );
    };

    const formatPrice = (price) => {
        if (price === 0 || price === null) return "Free";
        return `$${price.toLocaleString()}`;
    };

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search courses by title, category, or instructor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Course</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Instructor</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Modules</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCourses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                    {searchTerm ? "No courses found matching your search" : "No courses available"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCourses.map((course) => (
                                <TableRow key={course.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-16 h-10 rounded overflow-hidden">
                                                <Image
                                                    src={course.thumbnail 
                                                        ? `/assets/images/courses/${course.thumbnail}`
                                                        : "/assets/images/courses/default.jpg"}
                                                    alt={course.title}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div>
                                                <div className="font-medium">{course.title}</div>
                                                <div className="text-sm text-gray-500 line-clamp-1">
                                                    {course.subtitle}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {course.category?.title || "Uncategorized"}
                                    </TableCell>
                                    <TableCell>
                                        {course.instructor 
                                            ? `${course.instructor.firstName} ${course.instructor.lastName}`
                                            : "Unknown"}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {formatPrice(course.price)}
                                    </TableCell>
                                    <TableCell>
                                        {course.modules?.length || 0} modules
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(course.active)}
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
                                                    <Link href={`/courses/${course.id}`}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/courses/${course.id}`}>
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Edit
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

            {/* Results count */}
            {filteredCourses.length > 0 && (
                <div className="text-sm text-gray-600">
                    Showing {filteredCourses.length} of {initialCourses.length} courses
                </div>
            )}
        </div>
    );
}

