"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function EnrollmentsTable({ enrollments: initialEnrollments }) {
    const [searchTerm, setSearchTerm] = useState("");
    const t = useTranslations("Admin");
    
    const filteredEnrollments = initialEnrollments.filter(enrollment => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            enrollment.course?.title?.toLowerCase().includes(search) ||
            enrollment.student?.firstName?.toLowerCase().includes(search) ||
            enrollment.student?.lastName?.toLowerCase().includes(search) ||
            enrollment.student?.email?.toLowerCase().includes(search)
        );
    });

    const getStatusBadge = (status) => {
        const variants = {
            'not-started': 'secondary',
            'in-progress': 'default',
            'completed': 'default',
            'completed': 'default'
        };
        const colors = {
            'not-started': 'bg-gray-100 text-gray-800',
            'in-progress': 'bg-blue-100 text-blue-800',
            'completed': 'bg-green-100 text-green-800'
        };
        return (
            <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>
                {status || t("unknown")}
            </Badge>
        );
    };

    const formatDate = (date) => {
        if (!date) return "N/A";
        return new Date(date).toLocaleDateString();
    };

    const formatPrice = (price) => {
        if (price === 0 || price === null || price === undefined) return t("free");
        return `$${Number(price).toLocaleString()}`;
    };

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="flex-1 relative max-w-md">
                    <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder={t("searchEnrollmentsPlaceholder")}
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
                            <TableHead>{t("student")}</TableHead>
                            <TableHead>{t("enrollmentDate")}</TableHead>
                            <TableHead>{t("status")}</TableHead>
                            <TableHead>{t("amount")}</TableHead>
                            <TableHead>{t("method")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEnrollments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                    {searchTerm ? t("noEnrollmentsFound") : t("noEnrollmentsAvailable")}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredEnrollments.map((enrollment) => (
                                <TableRow key={enrollment.id}>
                                    <TableCell dir="auto">
                                        {enrollment.course ? (
                                            <Link
                                                href={`/courses/${enrollment.course.id || enrollment.course._id}`}
                                                className="font-medium hover:underline"
                                            >
                                                {enrollment.course.title || t("unknownCourse")}
                                            </Link>
                                        ) : (
                                            <span className="text-gray-400">{t("courseDeleted")}</span>
                                        )}
                                    </TableCell>
                                    <TableCell dir="auto">
                                        {enrollment.student ? (
                                            <div>
                                                <div className="font-medium">
                                                    {enrollment.student.firstName} {enrollment.student.lastName}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {enrollment.student.email}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">{t("studentDeleted")}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(enrollment.enrollment_date)}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(enrollment.status)}
                                    </TableCell>
                                    <TableCell suppressHydrationWarning>
                                        {formatPrice(enrollment.course?.price)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {enrollment.method || "N/A"}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {filteredEnrollments.length > 0 && (
                <div className="text-sm text-gray-600">
                    {t("showingEnrollments", { filtered: filteredEnrollments.length, total: initialEnrollments.length })}
                </div>
            )}
        </div>
    );
}

