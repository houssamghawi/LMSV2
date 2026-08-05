import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";

import { GenerationJob } from "@/model/generation-job-model";
import { AIProcessingConsent } from "@/model/ai-consent-model";
import { AdminQuizConfig } from "@/model/admin-quiz-config-model";
import { Quiz } from "@/model/quizv2-model";
import { Question } from "@/model/questionv2-model";
import { Attempt } from "@/model/attemptv2-model";
import { normalizeText, computeContentHash } from "@/service/docx-extractor";
import {
    quizGenerationParamsSchema,
    adminQuizConfigSchema,
    gradeShortAnswerSchema,
    updateDraftQuestionSchema,
    regenerateDraftSchema,
    saveDraftAsQuizSchema,
    quizConsentSchema
} from "@/lib/validations";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/quiz-generation-prompt";
import {
    DEFAULT_GENERATION_PARAMS,
    AI_CONSENT_VERSION,
    SHORT_ANSWER_MAX_LENGTH,
    SOURCE_QUOTE_MAX_WORDS
} from "@/lib/constants";

let courseId;
let userId;

beforeAll(() => {
    courseId = new mongoose.Types.ObjectId().toString();
    userId = new mongoose.Types.ObjectId().toString();
});

afterAll(() => {
    // setup.js handles DB teardown
});

describe("Phase 2 foundational: models", () => {
    it("GenerationJob round-trips with embedded DraftQuestion sub-documents and params", async () => {
        const job = await GenerationJob.create({
            userId,
            courseId,
            status: "queued",
            sourceFilename: "lecture.docx",
            sourceByteSize: 1024,
            sourceContentHash: computeContentHash("hello world"),
            consentVersion: AI_CONSENT_VERSION,
            params: DEFAULT_GENERATION_PARAMS,
            draftQuestions: [
                {
                    draftId: "u1",
                    type: "single",
                    difficulty: "easy",
                    text: "What is X?",
                    options: [
                        { id: "a", text: "A" },
                        { id: "b", text: "B" }
                    ],
                    correctOptionIds: ["a"],
                    modelAnswer: "",
                    explanation: "Because A.",
                    sourceQuote: "X is A.",
                    instructorState: "untouched"
                },
                {
                    draftId: "u2",
                    type: "true_false",
                    difficulty: "hard",
                    text: "X is a process.",
                    options: [
                        { id: "t", text: "True" },
                        { id: "f", text: "False" }
                    ],
                    correctOptionIds: ["t"],
                    modelAnswer: "",
                    explanation: "Per the lecture.",
                    sourceQuote: "X is the process of A.",
                    instructorState: "untouched"
                }
            ]
        });
        const fetched = await GenerationJob.findById(job._id).lean();
        expect(fetched.draftQuestions).toHaveLength(2);
        expect(fetched.draftQuestions[0].correctOptionIds).toEqual(["a"]);
        expect(fetched.draftQuestions[1].correctOptionIds).toEqual(["t"]);
        expect(fetched.params.totalQuestions).toBe(10);
    });

    it("GenerationJob accepts draftQuestions with empty sourceQuote after grounding strip", async () => {
        const job = await GenerationJob.create({
            userId,
            courseId,
            sourceFilename: "lecture.docx",
            sourceByteSize: 1024,
            sourceContentHash: computeContentHash("hello world"),
            consentVersion: AI_CONSENT_VERSION,
            params: DEFAULT_GENERATION_PARAMS,
            draftQuestions: [
                {
                    draftId: "u1",
                    type: "single",
                    difficulty: "easy",
                    text: "What is X?",
                    options: [
                        { id: "a", text: "A" },
                        { id: "b", text: "B" }
                    ],
                    correctOptionIds: ["a"],
                    modelAnswer: "",
                    explanation: "Because A.",
                    sourceQuote: "",
                    instructorState: "untouched"
                }
            ]
        });
        const fetched = await GenerationJob.findById(job._id).lean();
        expect(fetched.draftQuestions[0].sourceQuote).toBe("");
    });

    it("GenerationJob rejects bad draftQuestion: MCQ with too few options", async () => {
        await expect(
            GenerationJob.create({
                userId,
                courseId,
                sourceFilename: "x.docx",
                sourceByteSize: 1,
                sourceContentHash: "h",
                consentVersion: "1.0.0",
                params: DEFAULT_GENERATION_PARAMS,
                draftQuestions: [
                    {
                        draftId: "u",
                        type: "single",
                        difficulty: "easy",
                        text: "Explain.",
                        options: [{ id: "a", text: "A" }],
                        correctOptionIds: ["a"],
                        modelAnswer: "",
                        explanation: "x",
                        sourceQuote: "q"
                    }
                ]
            })
        ).rejects.toThrow();
    });

    it("AIProcessingConsent enforces unique (userId, consentVersion)", async () => {
        await AIProcessingConsent.create({
            userId,
            consentVersion: AI_CONSENT_VERSION,
            acknowledgedAt: new Date()
        });
        await expect(
            AIProcessingConsent.create({
                userId,
                consentVersion: AI_CONSENT_VERSION,
                acknowledgedAt: new Date()
            })
        ).rejects.toThrow();
    });

    it("AdminQuizConfig singleton: create then upsert", async () => {
        const admin = new mongoose.Types.ObjectId();
        const cfg = await AdminQuizConfig.create({
            dailyQuotaPerInstructor: 5,
            maxDocumentSizeBytes: 10 * 1024 * 1024,
            maxQuestionsPerGeneration: 30,
            sourceRetentionEnabled: false,
            sourceRetentionDays: 30,
            updatedBy: admin
        });
        expect(cfg.dailyQuotaPerInstructor).toBe(5);
        // Upsert pattern: findOneAndUpdate({}, ..., { upsert: true })
        const updated = await AdminQuizConfig.findOneAndUpdate(
            {},
            { dailyQuotaPerInstructor: 10, updatedBy: admin },
            { new: true, upsert: true }
        );
        expect(updated.dailyQuotaPerInstructor).toBe(10);
        const count = await AdminQuizConfig.countDocuments();
        expect(count).toBe(1);
    });

    it("Question model: short_answer type accepts empty options + modelAnswer", async () => {
        const quiz = await Quiz.create({
            courseId,
            title: "Q",
            createdBy: userId
        });
        const q = await Question.create({
            quizId: quiz._id,
            type: "short_answer",
            text: "Explain X.",
            options: [],
            correctOptionIds: [],
            modelAnswer: "answer",
            explanation: "because",
            sourceQuote: "X is A.",
            difficulty: "hard",
            order: 0
        });
        expect(q.modelAnswer).toBe("answer");
        expect(q.difficulty).toBe("hard");
    });

    it("Question model: short_answer rejects non-empty options", async () => {
        const quiz = await Quiz.create({
            courseId,
            title: "Q2",
            createdBy: userId
        });
        await expect(
            Question.create({
                quizId: quiz._id,
                type: "short_answer",
                text: "Explain Y.",
                options: [{ id: "a", text: "A" }],
                correctOptionIds: [],
                modelAnswer: "a",
                order: 0
            })
        ).rejects.toThrow();
    });

    it("Quiz model: aiGenerated flag and generationJobId link", async () => {
        const job = await GenerationJob.create({
            userId,
            courseId,
            sourceFilename: "l.docx",
            sourceByteSize: 1,
            sourceContentHash: "h",
            consentVersion: AI_CONSENT_VERSION,
            params: DEFAULT_GENERATION_PARAMS
        });
        const quiz = await Quiz.create({
            courseId,
            title: "AI Quiz",
            createdBy: userId,
            aiGenerated: true,
            generationJobId: job._id
        });
        expect(quiz.aiGenerated).toBe(true);
        expect(quiz.generationJobId.toString()).toBe(job._id.toString());
    });

    it("Attempt model: pending_grading status + SA grading fields", async () => {
        const quiz = await Quiz.create({
            courseId,
            title: "Q3",
            createdBy: userId
        });
        const attempt = await Attempt.create({
            quizId: quiz._id,
            studentId: new mongoose.Types.ObjectId(),
            status: "pending_grading",
            hasShortAnswers: true,
            pendingGradingCount: 2,
            answers: [
                {
                    questionId: new mongoose.Types.ObjectId(),
                    textResponse: "student answer",
                    graded: false,
                    awardedPoints: null
                }
            ]
        });
        expect(attempt.status).toBe("pending_grading");
        expect(attempt.pendingGradingCount).toBe(2);
        expect(attempt.answers[0].textResponse).toBe("student answer");
    });
});

describe("Phase 2 foundational: validations", () => {
    it("quizGenerationParamsSchema enforces count sums", () => {
        const ok = quizGenerationParamsSchema.safeParse({
            totalQuestions: 10,
            mcqCount: 5,
            trueFalseCount: 5,
            easyCount: 4,
            mediumCount: 4,
            hardCount: 2
        });
        expect(ok.success).toBe(true);

        const bad = quizGenerationParamsSchema.safeParse({
            totalQuestions: 10,
            mcqCount: 5,
            trueFalseCount: 4,
            easyCount: 4,
            mediumCount: 4,
            hardCount: 2
        });
        expect(bad.success).toBe(false);
    });

    it("adminQuizConfigSchema is strict and bounds values", () => {
        const ok = adminQuizConfigSchema.safeParse({
            dailyQuotaPerInstructor: 20,
            maxDocumentSizeBytes: 10485760,
            maxQuestionsPerGeneration: 30,
            sourceRetentionEnabled: false
        });
        expect(ok.success).toBe(true);

        const tooBig = adminQuizConfigSchema.safeParse({
            dailyQuotaPerInstructor: 5000, // > 1000
            maxDocumentSizeBytes: 10485760,
            maxQuestionsPerGeneration: 30,
            sourceRetentionEnabled: false
        });
        expect(tooBig.success).toBe(false);
    });

    it("gradeShortAnswerSchema validates awardedPoints floor", () => {
        expect(gradeShortAnswerSchema.safeParse({ awardedPoints: 0 }).success).toBe(true);
        expect(gradeShortAnswerSchema.safeParse({ awardedPoints: 5, graderComment: "good" }).success).toBe(true);
        expect(gradeShortAnswerSchema.safeParse({ awardedPoints: -1 }).success).toBe(false);
    });

    it("updateDraftQuestionSchema allows partial edit for MCQ/TF", () => {
        const ok = updateDraftQuestionSchema.safeParse({
            text: "Updated text",
            instructorState: "edited"
        });
        expect(ok.success).toBe(true);

        const badOptions = updateDraftQuestionSchema.safeParse({
            type: "single",
            options: [{ id: "a", text: "A" }]
        });
        expect(badOptions.success).toBe(false);
    });

    it("regenerateDraftSchema requires draftId when scope=single", () => {
        const ok = regenerateDraftSchema.safeParse({
            scope: "single",
            draftId: "u1"
        });
        expect(ok.success).toBe(true);
        const bad = regenerateDraftSchema.safeParse({ scope: "single" });
        expect(bad.success).toBe(false);
    });

    it("saveDraftAsQuizSchema is strict", () => {
        const ok = saveDraftAsQuizSchema.safeParse({
            title: "Chapter 5 Quiz",
            passPercent: 70
        });
        expect(ok.success).toBe(true);
        // extra field rejected
        const bad = saveDraftAsQuizSchema.safeParse({
            title: "X",
            createdBy: "should-not-be-allowed"
        });
        expect(bad.success).toBe(false);
    });

    it("quizConsentSchema accepts check/acknowledge", () => {
        expect(quizConsentSchema.safeParse({ action: "check" }).success).toBe(true);
        expect(quizConsentSchema.safeParse({ action: "acknowledge", consentVersion: "1.0.0" }).success).toBe(true);
        expect(quizConsentSchema.safeParse({ action: "nope" }).success).toBe(false);
    });
});

describe("Phase 2 foundational: docx extractor", () => {
    it("normalizeText collapses whitespace and applies NFKC", () => {
        expect(normalizeText("  Hello\u00A0  \t world  ")).toBe("Hello world");
        expect(normalizeText("ＡＢＣ")).toBe("ABC"); // fullwidth -> ASCII via NFKC
    });

    it("computeContentHash returns stable 64-char hex", () => {
        const h = computeContentHash("hello");
        expect(h).toMatch(/^[a-f0-9]{64}$/);
        expect(computeContentHash("hello")).toBe(h);
        expect(computeContentHash("world")).not.toBe(h);
    });
});

describe("Phase 2 foundational: prompt templates", () => {
    it("buildSystemPrompt includes the requested mix and sourceQuote word limit", () => {
        const sys = buildSystemPrompt(DEFAULT_GENERATION_PARAMS);
        expect(sys).toContain(String(DEFAULT_GENERATION_PARAMS.totalQuestions));
        expect(sys).toContain(String(SOURCE_QUOTE_MAX_WORDS));
        expect(sys).toContain("true_false");
        expect(sys).toContain("Essay questions are FORBIDDEN");
        expect(sys).toContain('"single" | "true_false"');
    });

    it("buildUserPrompt embeds the lecture text", () => {
        const user = buildUserPrompt("Photosynthesis converts light into chemical energy.", DEFAULT_GENERATION_PARAMS);
        expect(user).toContain("Photosynthesis");
        expect(user).toContain(String(SOURCE_QUOTE_MAX_WORDS));
    });
});

describe("Phase 2 foundational: constants", () => {
    it("exposes AI_CONSENT_VERSION and SHORT_ANSWER_MAX_LENGTH", () => {
        expect(AI_CONSENT_VERSION).toBeTruthy();
        expect(SHORT_ANSWER_MAX_LENGTH).toBe(2000);
    });
});
