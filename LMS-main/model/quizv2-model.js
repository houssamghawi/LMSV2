import mongoose, { Schema } from "mongoose";

const quizSchema = new Schema({
    courseId: {
        type: Schema.Types.ObjectId,
        ref: "Course",
        required: true,
        index: true
    },
    lessonId: {
        type: Schema.Types.ObjectId,
        ref: "Lesson",
        default: null
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    published: {
        type: Boolean,
        default: false,
        index: true
    },
    required: {
        type: Boolean,
        default: false
    },
    passPercent: {
        type: Number,
        default: 70,
        min: 0,
        max: 100
    },
    timeLimitSec: {
        type: Number,
        default: null,
        min: 1
    },
    maxAttempts: {
        type: Number,
        default: null,
        min: 1
    },
    shuffleQuestions: {
        type: Boolean,
        default: false
    },
    shuffleOptions: {
        type: Boolean,
        default: false
    },
    showAnswersPolicy: {
        type: String,
        enum: ["never", "after_submit", "after_pass"],
        default: "after_submit"
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {
    timestamps: true
});

// Indexes
quizSchema.index({ courseId: 1, published: 1 });
quizSchema.index({ lessonId: 1 });
quizSchema.index({ courseId: 1, lessonId: 1 });
quizSchema.index({ createdBy: 1 });

export const Quiz = mongoose.models.Quiz || mongoose.model("Quiz", quizSchema);
