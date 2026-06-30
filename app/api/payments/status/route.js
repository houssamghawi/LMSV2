import { NextResponse } from "next/server";
import { dbConnect } from "@/service/mongo";
import { Payment } from "@/model/payment-model";
import { Enrollment } from "@/model/enrollment-model";
import mongoose from "mongoose";

/**
 * GET /api/payments/status?session_id=cs_...
 * 
 * Returns payment and enrollment status based on session_id.
 * Uses Payment record as source of truth (not Stripe API).
 * 
 * Response format:
 * {
 *   ok: boolean,
 *   isPaid: boolean,
 *   isEnrolled: boolean,
 *   paymentStatus: string,
 *   paymentId?: string,
 *   userId?: string,
 *   courseId?: string,
 *   state?: string,
 *   error?: string
 * }
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        // Validate session_id
        if (!sessionId || !sessionId.startsWith('cs_')) {
            return NextResponse.json(
                { 
                    ok: false, 
                    error: 'Invalid session_id. Must start with "cs_".' 
                },
                { 
                    status: 400,
                    headers: {
                        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
                    }
                }
            );
        }

        // Ensure DB connection
        await dbConnect();

        // Find Payment by sessionId (source of truth) - direct query, no populate
        const payment = await Payment.findOne({ sessionId }).lean();

        if (!payment) {
            // Payment not found in DB yet (webhook may not have processed)
            return NextResponse.json({
                ok: true,
                isPaid: false,
                isEnrolled: false,
                paymentStatus: 'not_found',
                state: 'WAITING_FOR_WEBHOOK',
                message: 'Payment record not found. Webhook may still be processing.'
            }, {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
                }
            });
        }

        // Payment exists - check status
        const isPaid = payment.status === 'succeeded';
        
        // Use Payment record's user and course IDs to check enrollment
        const userId = payment.user;
        const courseId = payment.course;

        if (!userId || !courseId) {
            return NextResponse.json({
                ok: true,
                isPaid,
                isEnrolled: false,
                paymentStatus: payment.status,
                error: 'Payment record missing user or course reference'
            }, {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
                }
            });
        }

        // Check enrollment using Payment's user/course (direct query, no populate for performance)
        const enrollmentExists = await Enrollment.exists({
            student: userId,
            course: courseId
        });

        const isEnrolled = !!enrollmentExists;

        return NextResponse.json({
            ok: true,
            isPaid,
            isEnrolled,
            paymentStatus: payment.status,
            paymentId: payment._id.toString(),
            userId: userId.toString(),
            courseId: courseId.toString()
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
            }
        });

    } catch (error) {
        console.error('[PAYMENT_STATUS] Error:', error);
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { 
                status: 500,
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
                }
            }
        );
    }
}
