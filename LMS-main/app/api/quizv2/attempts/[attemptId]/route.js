import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { getAttemptById } from "@/queries/quizv2";
import { isAdmin, verifyInstructorOwnsCourse } from "@/lib/authorization";
import mongoose from "mongoose";

/** GET attempt by ID. BOLA: student owns attempt, or instructor/admin owns course. */
export async function GET(request, { params }) {
    try {
        const { attemptId } = await params;
        if (!attemptId || !mongoose.Types.ObjectId.isValid(attemptId)) {
            return NextResponse.json(
                { ok: false, error: "Invalid attempt ID" },
                { status: 400 }
            );
        }
        const user = await getLoggedInUser();
        if (!user) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized" },
                { status: 401 }
            );
        }
        const attempt = await getAttemptById(attemptId);
        if (!attempt) {
            return NextResponse.json(
                { ok: false, error: "Attempt not found" },
                { status: 404 }
            );
        }
        
        // Verify ownership (unless admin)
        const isInstructorOrAdmin = user.role === "instructor" || user.role === "admin";
        // Handle both string ID and populated object
        const attemptStudentId = typeof attempt.studentId === 'object' && attempt.studentId !== null
            ? (attempt.studentId.id || attempt.studentId._id || attempt.studentId).toString()
            : attempt.studentId.toString();
        const isOwner = attemptStudentId === user.id;
        
        if (!isOwner && !isInstructorOrAdmin) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized" },
                { status: 403 }
            );
        }
        
        if (isInstructorOrAdmin && !isOwner) {
            // Verify instructor owns the course
            // Handle both string ID and populated object for quizId
            const quizCourseId = typeof attempt.quizId === 'object' && attempt.quizId !== null
                ? (attempt.quizId.courseId || attempt.quizId.courseId?.id || attempt.quizId.courseId?._id || attempt.quizId).toString()
                : attempt.quizId.toString();
            const ownsCourse = await verifyInstructorOwnsCourse(
                quizCourseId,
                user.id,
                user
            );
            
            if (!ownsCourse && !isAdmin(user)) {
                return NextResponse.json(
                    { ok: false, error: "Unauthorized" },
                    { status: 403 }
                );
            }
        }
        
        // Convert to plain object
        const plainAttempt = JSON.parse(JSON.stringify(attempt));
        
        return NextResponse.json({ ok: true, attempt: plainAttempt });
    } catch (error) {
        console.error("[GET_ATTEMPT] Error:", error);
        return NextResponse.json(
            { ok: false, error: error.message || "Failed to get attempt" },
            { status: 500 }
        );
    }
}
