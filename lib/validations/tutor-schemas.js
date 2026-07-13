import { z } from "zod";
import {
    TUTOR_QUESTION_MAX_LENGTH,
    TUTOR_REPORT_DETAILS_MAX_LENGTH,
    TUTOR_CONTEXT_STATUSES,
    TUTOR_FEEDBACK_VALUES,
    TUTOR_REPORT_REASONS
} from "@/lib/constants";

const objectIdSchema = z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid ID format");

const conversationTurnSchema = z.object({
    role: z.enum(["student", "tutor"]),
    content: z.string().min(1).max(TUTOR_QUESTION_MAX_LENGTH)
});

export const tutorAskSchema = z
    .object({
        lessonId: objectIdSchema,
        courseId: objectIdSchema,
        question: z
            .string()
            .min(1, "Question is required")
            .max(
                TUTOR_QUESTION_MAX_LENGTH,
                `Question must be at most ${TUTOR_QUESTION_MAX_LENGTH} characters`
            ),
        conversationHistory: z.array(conversationTurnSchema).max(8).optional()
    })
    .strict();

export const tutorFeedbackSchema = z
    .object({
        interactionId: objectIdSchema,
        feedback: z.enum(TUTOR_FEEDBACK_VALUES)
    })
    .strict();

export const tutorHistoryQuerySchema = z
    .object({
        courseId: objectIdSchema,
        lessonId: objectIdSchema.optional(),
        contextStatus: z.enum(TUTOR_CONTEXT_STATUSES).optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20)
    })
    .strict();

export const tutorConfigUpdateSchema = z
    .object({
        courseId: objectIdSchema.nullable().optional(),
        outOfContextMessage: z
            .object({
                en: z.string().min(10).max(500).optional(),
                ar: z.string().min(10).max(500).optional()
            })
            .optional(),
        enabled: z.boolean().optional(),
        rateLimitPerHour: z.number().int().min(1).max(100).optional(),
        relevanceThreshold: z.number().min(0.5).max(0.95).optional(),
        maxContextChunks: z.number().int().min(1).max(10).optional()
    })
    .strict();

export const tutorConfigQuerySchema = z
    .object({
        courseId: objectIdSchema.optional()
    })
    .strict();

export const tutorReportSchema = z
    .object({
        interactionId: objectIdSchema,
        reason: z.enum(TUTOR_REPORT_REASONS),
        details: z
            .string()
            .max(
                TUTOR_REPORT_DETAILS_MAX_LENGTH,
                `Details must be at most ${TUTOR_REPORT_DETAILS_MAX_LENGTH} characters`
            )
            .optional()
    })
    .strict();
