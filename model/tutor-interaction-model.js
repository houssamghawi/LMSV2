import mongoose, { Schema } from "mongoose";

const tutorInteractionSchema = new Schema({
    question: {
        type: String,
        required: true,
        maxlength: 1000
    },
    response: {
        type: String,
        required: true
    },
    citation: {
        type: String,
        default: null
    },
    contextStatus: {
        type: String,
        required: true,
        enum: ["answered", "out_of_context"],
        index: true
    },
    contextChunkIds: {
        type: [String],
        default: []
    },
    detectedLanguage: {
        type: String,
        required: true,
        enum: ["ar", "en"]
    },
    studentId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    courseId: {
        type: Schema.Types.ObjectId,
        ref: "Course",
        required: true,
        index: true
    },
    lessonId: {
        type: Schema.Types.ObjectId,
        ref: "Lesson",
        required: true,
        index: true
    },
    feedback: {
        type: String,
        enum: ["helpful", "not_helpful"],
        default: null
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    metadata: {
        modelUsed: String,
        tokensInput: Number,
        tokensOutput: Number,
        responseTimeMs: Number,
        relevanceScores: [Number]
    }
});

tutorInteractionSchema.index({ lessonId: 1, studentId: 1, createdAt: -1 });
tutorInteractionSchema.index({ courseId: 1, contextStatus: 1, createdAt: -1 });

export const TutorInteraction =
    mongoose.models.TutorInteraction ||
    mongoose.model("TutorInteraction", tutorInteractionSchema);
