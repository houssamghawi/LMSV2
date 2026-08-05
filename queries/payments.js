import { dbConnect } from "@/service/mongo";
import { Payment } from "@/model/payment-model";
import { replaceMongoIdInObject, replaceMongoIdInArray } from "@/lib/convertData";

/**
 * Create a payment record
 */
export async function createPayment(paymentData) {
    await dbConnect();
    try {
        const payment = await Payment.create(paymentData);
        return replaceMongoIdInObject(payment.toObject());
    } catch (error) {
        throw new Error(`Failed to create payment: ${error.message}`);
    }
}

/**
 * Find payment by session ID (for Stripe - backward compatibility)
 */
export async function getPaymentBySessionId(sessionId) {
    await dbConnect();
    try {
        const payment = await Payment.findOne({ sessionId })
            .populate('user', 'firstName lastName email')
            .populate('course', 'title price')
            .lean();
        return payment ? replaceMongoIdInObject(payment) : null;
    } catch (error) {
        throw new Error(`Failed to get payment: ${error.message}`);
    }
}

/**
 * Find payment by reference ID (for MockPay)
 */
export async function getPaymentByReferenceId(referenceId) {
    await dbConnect();
    try {
        const payment = await Payment.findOne({ referenceId })
            .populate('user', 'firstName lastName email')
            .populate('course', 'title price')
            .lean();
        return payment ? replaceMongoIdInObject(payment) : null;
    } catch (error) {
        throw new Error(`Failed to get payment: ${error.message}`);
    }
}

/**
 * Find payment by payment intent ID (for Stripe - backward compatibility)
 */
export async function getPaymentByPaymentIntentId(paymentIntentId) {
    await dbConnect();
    try {
        const payment = await Payment.findOne({ paymentIntentId })
            .populate('user', 'firstName lastName email')
            .populate('course', 'title price')
            .lean();
        return payment ? replaceMongoIdInObject(payment) : null;
    } catch (error) {
        throw new Error(`Failed to get payment: ${error.message}`);
    }
}

/**
 * Find payment by ID (generic)
 */
export async function getPaymentById(paymentId) {
    await dbConnect();
    try {
        const payment = await Payment.findById(paymentId)
            .populate('user', 'firstName lastName email')
            .populate('course', 'title price')
            .lean();
        return payment ? replaceMongoIdInObject(payment) : null;
    } catch (error) {
        throw new Error(`Failed to get payment: ${error.message}`);
    }
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(sessionId, status, additionalData = {}) {
    await dbConnect();
    try {
        const updateData = {
            status,
            updatedAt: new Date(),
            ...additionalData
        };
        
        if (status === 'succeeded' && !additionalData.paidAt) {
            updateData.paidAt = new Date();
        }
        
        if (status === 'refunded' || status === 'partially_refunded') {
            if (!additionalData.refundedAt) {
                updateData.refundedAt = new Date();
            }
        }
        
        const payment = await Payment.findOneAndUpdate(
            { sessionId },
            updateData,
            { new: true }
        ).lean();
        
        return payment ? replaceMongoIdInObject(payment) : null;
    } catch (error) {
        throw new Error(`Failed to update payment: ${error.message}`);
    }
}

/**
 * Get payments for a user
 */
export async function getPaymentsForUser(userId) {
    await dbConnect();
    try {
        const payments = await Payment.find({ user: userId })
            .populate('course', 'title thumbnail price')
            .sort({ createdAt: -1 })
            .lean();
        return replaceMongoIdInArray(payments);
    } catch (error) {
        throw new Error(`Failed to get user payments: ${error.message}`);
    }
}

/**
 * Get payments for a course
 */
export async function getPaymentsForCourse(courseId) {
    await dbConnect();
    try {
        const payments = await Payment.find({ course: courseId })
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .lean();
        return replaceMongoIdInArray(payments);
    } catch (error) {
        throw new Error(`Failed to get course payments: ${error.message}`);
    }
}

/**
 * Check if payment exists for session (idempotency check - Stripe)
 */
export async function paymentExistsBySessionId(sessionId) {
    await dbConnect();
    try {
        const payment = await Payment.findOne({ sessionId }).lean();
        return !!payment;
    } catch (error) {
        throw new Error(`Failed to check payment: ${error.message}`);
    }
}

/**
 * Check if payment exists for reference (idempotency check - MockPay)
 */
export async function paymentExistsByReferenceId(referenceId) {
    await dbConnect();
    try {
        const payment = await Payment.findOne({ referenceId }).lean();
        return !!payment;
    } catch (error) {
        throw new Error(`Failed to check payment: ${error.message}`);
    }
}

/**
 * Get total revenue for a course
 */
export async function getCourseRevenue(courseId) {
    await dbConnect();
    try {
        const result = await Payment.aggregate([
            {
                $match: {
                    course: new (await import('mongoose')).Types.ObjectId(courseId),
                    status: 'succeeded'
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$amount' },
                    totalPayments: { $sum: 1 }
                }
            }
        ]);
        
        return result[0] || { totalRevenue: 0, totalPayments: 0 };
    } catch (error) {
        throw new Error(`Failed to get course revenue: ${error.message}`);
    }
}
