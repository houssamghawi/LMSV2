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
import { Search, Star, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SafeImage } from "@/components/safe-image";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

export default function ReviewsTable({ reviews: initialReviews }) {
    const [searchTerm, setSearchTerm] = useState("");
    
    const filteredReviews = initialReviews.filter(review => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            review.content?.toLowerCase().includes(search) ||
            review.user?.firstName?.toLowerCase().includes(search) ||
            review.user?.lastName?.toLowerCase().includes(search) ||
            review.courseId?.title?.toLowerCase().includes(search)
        );
    });

    const renderStars = (rating) => {
        return (
            <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                    <Star
                        key={i}
                        className={`h-4 w-4 ${
                            i < (rating || 0)
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-gray-300"
                        }`}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="flex-1 relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search reviews by content, student, or course..."
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
                            <TableHead>Review</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredReviews.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                    {searchTerm ? "No reviews found" : "No reviews available"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredReviews.map((review) => (
                                <TableRow key={review.id}>
                                    <TableCell>
                                        <div className="max-w-md">
                                            <p className="text-sm line-clamp-3">
                                                {review.content || "No content"}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {review.user ? (
                                            <div className="flex items-center gap-2">
                                                <SafeImage
                                                    src={review.user.profilePicture}
                                                    alt={review.user.firstName}
                                                    width={32}
                                                    height={32}
                                                    className="rounded-full"
                                                    fallback="/assets/images/profile.jpg"
                                                />
                                                <div>
                                                    <div className="font-medium text-sm">
                                                        {review.user.firstName} {review.user.lastName}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {review.user.email}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">Unknown</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {review.courseId?.title || "Course deleted"}
                                    </TableCell>
                                    <TableCell>
                                        {renderStars(review.rating)}
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
                                                    className="text-red-600"
                                                    onClick={() => {
                                                        toast.info("Delete functionality coming soon");
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete Review
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

            {filteredReviews.length > 0 && (
                <div className="text-sm text-gray-600">
                    Showing {filteredReviews.length} of {initialReviews.length} reviews
                </div>
            )}
        </div>
    );
}

