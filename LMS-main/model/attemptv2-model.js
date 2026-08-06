import mongoose, { Schema } from "mongoose";

const answerSchema = new Schema({
    questionId: {
        type: Schema.Types.ObjectId,
        required: true
    },
    selectedOptionIds: {
        type: [String],
        default: []
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
        enum: ["in_progress", "submitted", "expired"],
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
    }
}, {
    timestamps: true
});

// Indexes
attemptSchema.index({ quizId: 1, studentId: 1, submittedAt: -1 });
attemptSchema.index({ studentId: 1, submittedAt: -1 });
// Partial unique index for one in-progress attempt per (quizId, studentId)
attemptSchema.index(
    { quizId: 1, studentId: 1 },
    { 
        unique: true,
        partialFilterExpression: { status: "in_progress" }
    }
);

export const Attempt = mongoose.models.Attempt || mongoose.model("Attempt", attemptSchema);
