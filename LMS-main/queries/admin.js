import "server-only";
import { dbConnect } from "@/service/mongo";
import { User } from "@/model/user-model";
import { Course } from "@/model/course-model";
import { Enrollment } from "@/model/enrollment-model";
import { Category } from "@/model/category-model";
import { Testimonial } from "@/model/testimonial-model";
import { Payment } from "@/model/payment-model";
import { replaceMongoIdInArray, replaceMongoIdInObject } from "@/lib/convertData";

/**
 * Get admin dashboard statistics
 */
export async function getAdminStats() {
    await dbConnect();
    
    try {
        const [
            totalUsers,
            totalStudents,
            totalInstructors,
            totalAdmins,
            activeUsers,
            totalCourses,
            publishedCourses,
            draftCourses,
            totalEnrollments,
            totalCategories,
            totalReviews
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'instructor' }),
            User.countDocuments({ role: 'admin' }),
            User.countDocuments({ 
                $or: [
                    { status: 'active' },
                    { status: { $exists: false } } // Count as active if status doesn't exist (legacy)
                ]
            }),
            Course.countDocuments(),
            Course.countDocuments({ active: true }),
            Course.countDocuments({ active: false }),
            Enrollment.countDocuments(),
            Category.countDocuments(),
            Testimonial.countDocuments()
        ]);

        // Calculate revenue from Payment model (accurate, includes only successful payments)
        const revenueResult = await Payment.aggregate([
            {
                $match: {
                    status: 'succeeded' // Only count successful payments
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        
        const revenue = revenueResult[0]?.total || 0;

        // Recent activities (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        // Handle users without createdAt field (legacy data)
        const recentUsers = await User.countDocuments({ 
            $or: [
                { createdAt: { $gte: sevenDaysAgo } },
                { createdAt: { $exists: false } } // Count as recent if no createdAt
            ]
        });
        const recentCourses = await Course.countDocuments({ createdOn: { $gte: sevenDaysAgo } });
        const recentEnrollments = await Enrollment.countDocuments({ enrollment_date: { $gte: sevenDaysAgo } });

        return {
            users: {
                total: totalUsers,
                students: totalStudents,
                instructors: totalInstructors,
                admins: totalAdmins,
                active: activeUsers,
                recent: recentUsers
            },
            courses: {
                total: totalCourses,
                published: publishedCourses,
                draft: draftCourses,
                recent: recentCourses
            },
            enrollments: {
                total: totalEnrollments,
                recent: recentEnrollments
            },
            revenue: {
                total: revenue,
                currency: 'USD'
            },
            categories: {
                total: totalCategories
            },
            reviews: {
                total: totalReviews
            }
        };
    } catch (error) {
        console.error('Error getting admin stats:', error);
        throw error;
    }
}

/**
 * Get all users with pagination, search, and filters
 */
export async function getUsers(params = {}) {
    await dbConnect();
    
    const {
        page = 1,
        limit = 20,
        search = '',
        role = '',
        status = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = params;

    const skip = (page - 1) * limit;
    
    // Build sort - handle missing createdAt field for legacy users
    let sort = {};
    if (sortBy === 'createdAt') {
        // Sort by createdAt if exists, otherwise by _id (which always exists)
        sort = { createdAt: sortOrder === 'desc' ? -1 : 1, _id: sortOrder === 'desc' ? -1 : 1 };
    } else {
        sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    }

    // Build query
    const query = {};
    
    // Search condition
    if (search) {
        query.$or = [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }
    
    // Role condition
    if (role) {
        query.role = role;
    }
    
    // Status condition - include users without status field as 'active' (legacy)
    if (status) {
        if (status === 'active') {
            // Include users with status='active' OR no status field (legacy users)
            // Use $or with existing search $or if it exists
            const statusCondition = {
                $or: [
                    { status: 'active' },
                    { status: { $exists: false } },
                    { status: null }
                ]
            };
            
            if (query.$or) {
                // We have both search and status filter - combine with $and
                query.$and = [
                    { $or: query.$or },
                    statusCondition
                ];
                delete query.$or;
            } else {
                // Only status filter
                query.$or = statusCondition.$or;
            }
        } else {
            // For inactive/suspended, only match exact status
            query.status = status;
        }
    }

    try {
        const [users, total] = await Promise.all([
            User.find(query)
                .select('-password')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(query)
        ]);

        // Ensure users array is never null/undefined
        const safeUsers = users || [];
        
        // Normalize user data - ensure status exists (default to 'active' for legacy)
        const normalizedUsers = safeUsers.map(user => {
            // Get createdAt from _id if it's an ObjectId
            let createdAt = user.createdAt;
            if (!createdAt && user._id) {
                try {
                    const mongoose = require('mongoose');
                    // Convert _id to ObjectId to get timestamp
                    const objectId = mongoose.Types.ObjectId.isValid(user._id) 
                        ? (user._id instanceof mongoose.Types.ObjectId 
                            ? user._id 
                            : new mongoose.Types.ObjectId(user._id))
                        : null;
                    
                    if (objectId) {
                        createdAt = objectId.getTimestamp();
                    }
                } catch (e) {
                    // Fallback to current date if extraction fails
                    createdAt = new Date();
                }
            }
            if (!createdAt) {
                createdAt = new Date();
            }
            
            return {
                ...user,
                status: user.status || 'active',
                createdAt: createdAt
            };
        });
        
        return {
            users: replaceMongoIdInArray(normalizedUsers),
            pagination: {
                page,
                limit,
                total: total || 0,
                totalPages: total > 0 ? Math.ceil(total / limit) : 0
            }
        };
    } catch (error) {
        console.error('Error getting users:', error);
        // Return stable error structure instead of throwing
        return {
            users: [],
            pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0
            },
            error: error?.message || 'Failed to fetch users'
        };
    }
}

/**
 * Get user by ID
 */
export async function getUserById(userId) {
    await dbConnect();
    try {
        if (!userId) {
            return null;
        }
        
        // Convert userId to ObjectId if it's a string
        const mongoose = require('mongoose');
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
            ? new mongoose.Types.ObjectId(userId) 
            : userId;
        
        const user = await User.findById(userIdObj).select('-password').lean();
        
        if (!user) {
            return null;
        }
        
        // Normalize user data
        const normalizedUser = {
            ...replaceMongoIdInObject(user),
            status: user.status || 'active',
            createdAt: user.createdAt || user._id?.getTimestamp?.() || new Date()
        };
        
        return normalizedUser;
    } catch (error) {
        console.error('Error getting user:', error);
        // Return null instead of throwing for better error handling
        return null;
    }
}

/**
 * Update user role
 */
export async function updateUserRole(userId, newRole) {
    await dbConnect();
    try {
        if (!userId || !newRole) {
            throw new Error('User ID and role are required');
        }
        
        // Convert userId to ObjectId if it's a string
        const mongoose = require('mongoose');
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
            ? new mongoose.Types.ObjectId(userId) 
            : userId;
        
        const user = await User.findByIdAndUpdate(
            userIdObj,
            { role: newRole, updatedAt: new Date() },
            { new: true, lean: true }
        ).select('-password');
        
        if (!user) {
            throw new Error('User not found');
        }
        
        // Normalize user data (client-safe: no Date/ObjectId)
        const plain = replaceMongoIdInObject(user);
        const rawDate = user.createdAt || user._id?.getTimestamp?.() || new Date();
        return {
            ...plain,
            status: user.status || 'active',
            createdAt: rawDate instanceof Date ? rawDate.toISOString() : String(rawDate)
        };
    } catch (error) {
        console.error('Error updating user role:', error);
        throw error;
    }
}

/**
 * Update user status
 */
export async function updateUserStatus(userId, status) {
    await dbConnect();
    try {
        if (!userId || !status) {
            throw new Error('User ID and status are required');
        }
        
        // Convert userId to ObjectId if it's a string
        const mongoose = require('mongoose');
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
            ? new mongoose.Types.ObjectId(userId) 
            : userId;
        
        const user = await User.findByIdAndUpdate(
            userIdObj,
            { status, updatedAt: new Date() },
            { new: true, lean: true }
        ).select('-password');
        
        if (!user) {
            throw new Error('User not found');
        }
        
        // Normalize user data (client-safe: no Date/ObjectId)
        const plain = replaceMongoIdInObject(user);
        const rawDate = user.createdAt || user._id?.getTimestamp?.() || new Date();
        return {
            ...plain,
            status: user.status || 'active',
            createdAt: rawDate instanceof Date ? rawDate.toISOString() : String(rawDate)
        };
    } catch (error) {
        console.error('Error updating user status:', error);
        throw error;
    }
}

/**
 * Delete user (with safety checks)
 */
export async function deleteUser(userId, currentAdminId) {
    await dbConnect();
    try {
        if (!userId) {
            throw new Error('User ID is required');
        }
        
        // Convert userId to ObjectId if it's a string
        const mongoose = require('mongoose');
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
            ? new mongoose.Types.ObjectId(userId) 
            : userId;
        
        // Convert to string for comparison (handle both ObjectId and string)
        const userIdStr = userIdObj.toString();
        const currentAdminIdStr = currentAdminId?.toString();
        
        // Prevent deleting yourself
        if (userIdStr === currentAdminIdStr) {
            throw new Error('Cannot delete your own account');
        }

        // Check if user is the last admin
        const adminCount = await User.countDocuments({ role: 'admin' });
        const user = await User.findById(userIdObj);
        
        if (!user) {
            throw new Error('User not found');
        }
        
        if (user.role === 'admin' && adminCount <= 1) {
            throw new Error('Cannot delete the last admin');
        }

        // Delete user
        await User.findByIdAndDelete(userIdObj);
        return { success: true };
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
}

/**
 * Bulk update users
 */
export async function bulkUpdateUsers(userIds, updates) {
    await dbConnect();
    try {
        // Convert all userIds to ObjectIds
        const mongoose = require('mongoose');
        const userIdsObj = userIds.map(id => 
            mongoose.Types.ObjectId.isValid(id) 
                ? new mongoose.Types.ObjectId(id) 
                : id
        );
        
        const result = await User.updateMany(
            { _id: { $in: userIdsObj } },
            { ...updates, updatedAt: new Date() }
        );
        return { success: true, modified: result.modifiedCount };
    } catch (error) {
        console.error('Error bulk updating users:', error);
        throw error;
    }
}

/**
 * Get enrollment analytics
 */
export async function getEnrollmentAnalytics(days = 30) {
    await dbConnect();
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const enrollments = await Enrollment.aggregate([
            {
                $match: {
                    enrollment_date: { $gte: startDate, $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$enrollment_date" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Return empty array if no data, not null
        const result = (enrollments || []).map(item => ({
            date: item._id || '',
            count: item.count || 0
        }));
        
        return result.length > 0 ? result : [];
    } catch (error) {
        console.error('Error getting enrollment analytics:', error);
        // Return empty array instead of throwing
        return [];
    }
}

/**
 * Get revenue analytics
 */
/**
 * Get revenue analytics from Payment model (accurate - only successful payments)
 */
export async function getRevenueAnalytics(days = 30) {
    await dbConnect();
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const Payment = (await import("@/model/payment-model")).Payment;
        
        const revenueByDate = await Payment.aggregate([
            {
                $match: {
                    status: 'succeeded', // Only successful payments
                    paidAt: { $gte: startDate, $exists: true }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$paidAt" }
                    },
                    revenue: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Return empty array if no data
        const result = (revenueByDate || []).map(item => ({
            date: item._id || '',
            revenue: item.revenue || 0,
            count: item.count || 0
        }));
        
        return result.length > 0 ? result : [];
    } catch (error) {
        console.error('Error getting revenue analytics:', error);
        // Return empty array instead of throwing
        return [];
    }
}

/**
 * Get top courses by revenue (from Payment model - accurate)
 */
export async function getTopCourses(limit = 10) {
    await dbConnect();
    try {
        const Payment = (await import("@/model/payment-model")).Payment;
        
        const topCourses = await Payment.aggregate([
            {
                $match: {
                    status: 'succeeded' // Only successful payments
                }
            },
            {
                $group: {
                    _id: "$course",
                    revenue: { $sum: '$amount' },
                    paymentCount: { $sum: 1 }
                }
            },
            {
                $sort: { revenue: -1 }
            },
            {
                $limit: limit
            },
            {
                $lookup: {
                    from: "courses",
                    localField: "_id",
                    foreignField: "_id",
                    as: "course"
                }
            },
            {
                $unwind: {
                    path: "$course",
                    preserveNullAndEmptyArrays: false // Only include courses that exist
                }
            },
            {
                $match: {
                    "course": { $ne: null }, // Ensure course exists
                    "course.active": { $ne: false } // Only active courses (or null)
                }
            },
            {
                $lookup: {
                    from: "enrollments",
                    localField: "_id",
                    foreignField: "course",
                    as: "enrollments"
                }
            },
            {
                $project: {
                    courseId: "$_id",
                    title: "$course.title",
                    revenue: 1,
                    paymentCount: 1,
                    enrollmentCount: { $size: "$enrollments" }
                }
            }
        ]);

        // Return empty array if no data
        return (topCourses || []).map(item => ({
            courseId: item.courseId?.toString() || '',
            title: item.title || 'Unknown Course',
            enrollmentCount: item.enrollmentCount || 0,
            revenue: item.revenue || 0,
            paymentCount: item.paymentCount || 0
        }));
    } catch (error) {
        console.error('Error getting top courses:', error);
        // Return empty array instead of throwing
        return [];
    }
}

