import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dbConnect } from "@/service/mongo";
import { Payment } from "@/model/payment-model";
import { Enrollment } from "@/model/enrollment-model";
import { getCourseDetails } from "@/queries/courses";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { mockPaymentConfirmSchema } from "@/lib/validations";

/**
 * POST /api/payments/mock/confirm
 * Creates a mock payment and enrollment for the authenticated user.
 * Mass assignment: only courseId and simulateFailure allowed (no amount, userId, etc.).
 * State: course active, paid, not already enrolled.
 */
export async function POST(request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { ok: false, error: 'Authentication required' },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const body = await request.json();
        const parsed = mockPaymentConfirmSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: 'Course ID is required' },
                { status: 400 }
            );
        }
        const { courseId, simulateFailure = false } = parsed.data;

        if (!mongoose.Types.ObjectId.isValid(courseId)) {
            return NextResponse.json(
                { ok: false, error: 'Invalid course ID format' },
                { status: 400 }
            );
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return NextResponse.json(
                { ok: false, error: 'Invalid user ID format' },
                { status: 400 }
            );
        }

        await dbConnect();

        // Get course details
        const course = await getCourseDetails(courseId);
        if (!course) {
            return NextResponse.json(
                { ok: false, error: 'Course not found' },
                { status: 404 }
            );
        }

        // Check if course is active
        if (!course.active) {
            return NextResponse.json(
                { ok: false, error: 'Course is not available for purchase' },
                { status: 400 }
            );
        }

        // Check course price
        const coursePrice = course.price || 0;
        if (coursePrice <= 0) {
            return NextResponse.json(
                { ok: false, error: 'Course is free. Please use free enrollment instead.' },
                { status: 400 }
            );
        }

        // Check if already enrolled
        const enrollmentExists = await Enrollment.exists({
            student: new mongoose.Types.ObjectId(userId),
            course: new mongoose.Types.ObjectId(courseId)
        });

        if (enrollmentExists) {
            return NextResponse.json(
                { ok: false, error: 'You are already enrolled in this course' },
                { status: 400 }
            );
        }

        // Handle failure simulation
        if (simulateFailure) {
            return NextResponse.json(
                { ok: false, error: 'Payment simulation failed (as requested)' },
                { status: 400 }
            );
        }

        // Generate unique reference ID
        const referenceId = `mock_${Date.now()}_${randomUUID().split('-')[0]}`;

        // Check if payment already exists (idempotency check)
        // For mockpay, we check by (user, course, provider) to prevent duplicates
        const existingPayment = await Payment.findOne({
            user: new mongoose.Types.ObjectId(userId),
            course: new mongoose.Types.ObjectId(courseId),
            provider: 'mockpay',
            status: 'succeeded'
        }).lean();

        let payment;
        let paymentId;

        if (existingPayment) {
            // Payment already exists - reuse it
            payment = existingPayment;
            paymentId = existingPayment._id;
            console.log('[MOCKPAY] Reusing existing payment:', paymentId.toString());
        } else {
            // Create new payment record
            try {
                payment = await Payment.create({
                    user: new mongoose.Types.ObjectId(userId),
                    course: new mongoose.Types.ObjectId(courseId),
                    provider: 'mockpay',
                    referenceId: referenceId,
                    amount: coursePrice,
                    currency: 'USD',
                    status: 'succeeded',
                    paidAt: new Date(),
                    metadata: {
                        courseTitle: course.title,
                        simulated: true
                    }
                });
                paymentId = payment._id;
                console.log('[MOCKPAY] Payment created:', paymentId.toString());
            } catch (paymentError) {
                // Handle duplicate key error (race condition)
                if (paymentError.code === 11000) {
                    // Try to get existing payment
                    const existing = await Payment.findOne({ referenceId }).lean();
                    if (existing) {
                        payment = existing;
                        paymentId = existing._id;
                        console.log('[MOCKPAY] Payment already exists (race condition), using existing:', paymentId.toString());
                    } else {
                        throw paymentError;
                    }
                } else {
                    throw paymentError;
                }
            }
        }

        // Create enrollment (idempotent)
        try {
            await Enrollment.create({
                student: new mongoose.Types.ObjectId(userId),
                course: new mongoose.Types.ObjectId(courseId),
                method: 'mockpay',
                enrollment_date: new Date(),
                status: 'not-started',
                payment: paymentId
            });
            console.log('[MOCKPAY] Enrollment created for user:', userId, 'course:', courseId);
        } catch (enrollmentError) {
            // Handle duplicate key error (unique constraint on student + course)
            if (enrollmentError.code === 11000) {
                console.log('[MOCKPAY] Enrollment already exists (idempotent)');
                // This is fine - enrollment already exists
            } else {
                // Other error - log but don't fail (payment was created)
                console.error('[MOCKPAY] Error creating enrollment:', enrollmentError);
                // Continue - payment was successful
            }
        }

        return NextResponse.json({
            ok: true,
            referenceId: referenceId,
            courseId: courseId,
            paymentId: paymentId.toString()
        });

    } catch (error) {
        console.error('[MOCKPAY] Error:', error);
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : 'An error occurred processing the payment'
            },
            { status: 500 }
        );
    }
}

