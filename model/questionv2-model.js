import mongoose, { Schema } from "mongoose";

const optionSchema = new Schema({
    id: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    }
}, { _id: false });

const questionSchema = new Schema({
    quizId: {
        type: Schema.Types.ObjectId,
        ref: "Quiz",
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ["single", "multi", "true_false", "short_answer"],
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true
    },
    options: {
        type: [optionSchema],
        required: true,
        validate: {
            // short_answer has no options; MCQ/TF need at least 2.
            validator: function (options) {
                if (this.type === "short_answer") return options.length === 0;
                return options.length >= 2;
            },
            message: "MCQ/TF questions must have at least 2 options; short_answer must have none"
        }
    },
    correctOptionIds: {
        type: [String],
        required: true,
        validate: {
            // short_answer has no correct options; MCQ/TF need at least one,
            // and all correctOptionIds must reference an option id.
            validator: function (ids) {
                if (this.type === "short_answer") return ids.length === 0;
                const optionIds = (this.options || []).map((o) => o.id);
                return (
                    ids.length > 0 &&
                    ids.length <= (this.options || []).length &&
                    ids.every((id) => optionIds.includes(id))
                );
            },
            message: "correctOptionIds must be a non-empty subset of option ids for MCQ/TF"
        }
    },
    // Expected answer for Short Answer questions. Empty for MCQ/TF.
    modelAnswer: {
        type: String,
        default: "",
        validate: {
            validator: function (v) {
                if (this.type === "short_answer") return typeof v === "string" && v.length > 0;
                return true;
            },
            message: "short_answer questions require a model answer"
        }
    },
    explanation: {
        type: String,
        default: ""
    },
    // Verbatim ≤30-word citation from the source document. Populated for
    // AI-generated questions; empty for manually authored ones.
    sourceQuote: {
        type: String,
        default: ""
    },
    // Optional difficulty tag for AI-generated questions.
    difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        default: null
    },
    points: {
        type: Number,
        default: 1,
        min: 0
    },
    order: {
        type: Number,
        required: true,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes
questionSchema.index({ quizId: 1, order: 1 });
// Supports filtering questions by type for grading queue queries (data-model.md §4).
questionSchema.index({ quizId: 1, type: 1 });

export const Question = mongoose.models.Question || mongoose.model("Question", questionSchema);
