import mongoose, { Schema } from "mongoose";

const answerSchema = new Schema({
    questionId: {
        type: Schema.Types.ObjectId,
        required: true
    },
    selectedOptionIds: {
        type: [String],
        default: []
    },
    // Short Answer free-text response. null for MCQ/TF questions.
    textResponse: {
        type: String,
        default: null,
        maxlength: 2000
    },
    // Grading state for Short Answer responses. MCQ/TF are auto-graded at
    // submit time (graded=true, awardedPoints set immediately).
    graded: {
        type: Boolean,
        default: false
    },
    awardedPoints: {
        type: Number,
        default: null,
        min: 0
    },
    graderComment: {
        type: String,
        default: "",
        maxlength: 1000
    },
    gradedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    gradedAt: {
        type: Date,
        default: null
    }
}, { _id: false });

const attemptSchema = new Schema({
    quizId: {
        type: Schema.Types.ObjectId,
        ref: "Quiz",
        required: true,
        index: true
    },
    studentId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ["in_progress", "submitted", "expired", "pending_grading"],
        default: "in_progress",
        index: true
    },
    startedAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    expiresAt: {
        type: Date,
        default: null
    },
    submittedAt: {
        type: Date,
        default: null
    },
    answers: {
        type: [answerSchema],
        default: []
    },
    score: {
        type: Number,
        default: 0
    },
    scorePercent: {
        type: Number,
        default: 0
    },
    passed: {
        type: Boolean,
        default: false
    },
    // True when the quiz has any short_answer questions; enables fast grading
    // queue filtering without joining to Question (data-model.md §6).
    hasShortAnswers: {
        type: Boolean,
        default: false
    },
    // Count of ungraded SA responses on this attempt. Decremented per-response
    // as the instructor grades. When it reaches 0, finalization triggers.
    pendingGradingCount: {
        type: Number,
        default: 0,
        min: 0
    },
    // Set when the overall score was finalized after all SA responses graded.
    finalizedAt: {
        type: Date,
        default: null
    },
    finalizedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null
    }
}, {
    timestamps: true
});

// Indexes
attemptSchema.index({ quizId: 1, studentId: 1, submittedAt: -1 });
attemptSchema.index({ studentId: 1, submittedAt: -1 });
// Partial unique index for one in-progress attempt per (quizId, studentId).
// Unchanged: allows a new in_progress attempt while another is pending_grading (FR-021).
attemptSchema.index(
    { quizId: 1, studentId: 1 },
    { 
        unique: true,
        partialFilterExpression: { status: "in_progress" }
    }
);
// Grading queue per quiz (data-model.md §6).
attemptSchema.index(
    { status: 1, quizId: 1 },
    { partialFilterExpression: { status: "pending_grading" } }
);
// Admin aggregate grading queue ordered by age.
attemptSchema.index(
    { status: 1, submittedAt: -1 },
    { partialFilterExpression: { status: "pending_grading" } }
);

export const Attempt = mongoose.models.Attempt || mongoose.model("Attempt", attemptSchema);
