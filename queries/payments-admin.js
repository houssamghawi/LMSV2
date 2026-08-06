import { dbConnect } from "@/service/mongo";
import { Payment } from "@/model/payment-model";
import { replaceMongoIdInArray } from "@/lib/convertData";

/**
 * Get payments for admin with pagination and filters
 */
export async function getPaymentsForAdmin(params = {}) {
    await dbConnect();
    
    try {
        const {
            page = 1,
            pageSize = 20,
            status,
            courseId,
            userId,
            startDate,
            endDate
        } = params;
        
        const skip = (page - 1) * pageSize;
        
        // Build query
        const query = {};
        
        if (status && status !== 'all') {
            query.status = status;
        }
        
        if (courseId) {
            query.course = courseId;
        }
        
        if (userId) {
            query.user = userId;
        }
        
        if (startDate || endDate) {
            query.paidAt = {};
            if (startDate) {
                query.paidAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.paidAt.$lte = new Date(endDate);
            }
        }
        
        // Get payments with populated user and course
        const [payments, total] = await Promise.all([
            Payment.find(query)
                .populate('user', 'firstName lastName email')
                .populate('course', 'title thumbnail')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageSize)
                .lean(),
            Payment.countDocuments(query)
        ]);
        
        const totalPages = Math.ceil(total / pageSize);
        
        return {
            payments: replaceMongoIdInArray(payments),
            total,
            page,
            pageSize,
            totalPages
        };
    } catch (error) {
        console.error('Error getting payments for admin:', error);
        throw error;
    }
}

