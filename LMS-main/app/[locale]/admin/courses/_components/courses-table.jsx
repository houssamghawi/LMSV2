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
import { MoreHorizontal, Eye, Edit, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getSafeImagePath } from "@/lib/utils";
import { adminDeleteCourse } from "@/app/actions/admin-courses";
import { DeleteCourseDialog } from "./delete-course-dialog";

export default function CoursesTable({ courses: initialCourses }) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const t = useTranslations("Admin");
    
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
            <Badge className="bg-green-100 text-green-800">{t("publishedBadge")}</Badge>
        ) : (
            <Badge variant="secondary">{t("draft")}</Badge>
        );
    };

    const formatPrice = (price) => {
        if (price === 0 || price === null) return t("free");
        return `$${price.toLocaleString()}`;
    };

    const handleDeleteClick = (course) => {
        setCourseToDelete(course);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!courseToDelete) return;

        setIsDeleting(true);
        try {
            await adminDeleteCourse(courseToDelete.id);
            toast.success(t("courseDeleted"));
            setDeleteDialogOpen(false);
            setCourseToDelete(null);
            router.refresh();
        } catch (error) {
            console.error('Delete course error:', error);
            toast.error(error?.message || t("failedDeleteCourse"));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder={t("searchCoursesPlaceholder")}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="ps-10"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("course")}</TableHead>
                            <TableHead>{t("category")}</TableHead>
                            <TableHead>{t("instructor")}</TableHead>
                            <TableHead>{t("amount")}</TableHead>
                            <TableHead>{t("modules")}</TableHead>
                            <TableHead>{t("status")}</TableHead>
                            <TableHead className="text-end">{t("actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCourses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                    {searchTerm ? t("noCoursesMatch") : t("noCoursesAvailable")}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCourses.map((course) => (
                                <TableRow key={course.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-16 h-10 rounded overflow-hidden">
                                                <Image
                                                    src={getSafeImagePath(course.thumbnail)}
                                                    alt={course.title}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div>
                                                <div className="font-medium" dir="auto">{course.title}</div>
                                                <div className="text-sm text-gray-500 line-clamp-1" dir="auto">
                                                    {course.subtitle}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell dir="auto">
                                        {course.category?.title || t("uncategorized")}
                                    </TableCell>
                                    <TableCell dir="auto">
                                        {course.instructor
                                            ? `${course.instructor.firstName} ${course.instructor.lastName}`
                                            : t("unknown")}
                                    </TableCell>
                                    <TableCell className="font-medium" suppressHydrationWarning>
                                        {formatPrice(course.price)}
                                    </TableCell>
                                    <TableCell>
                                        {t("modulesCount", { n: course.modules?.length || 0 })}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(course.active)}
                                    </TableCell>
                                    <TableCell className="text-end">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/courses/${course.id}`}>
                                                        <Eye className="h-4 w-4 me-2" />
                                                        {t("view")}
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/courses/${course.id}`}>
                                                        <Edit className="h-4 w-4 me-2" />
                                                        {t("edit")}
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-red-600"
                                                    onClick={() => handleDeleteClick(course)}
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

            {/* Results count */}
            {filteredCourses.length > 0 && (
                <div className="text-sm text-gray-600">
                    {t("showingCourses", { filtered: filteredCourses.length, total: initialCourses.length })}
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <DeleteCourseDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                course={courseToDelete}
                onConfirm={handleConfirmDelete}
                isPending={isDeleting}
            />
        </div>
    );
}

