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
        enum: ["single", "multi", "true_false"],
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
            validator: function(options) {
                return options.length >= 2;
            },
            message: "Question must have at least 2 options"
        }
    },
    correctOptionIds: {
        type: [String],
        required: true,
        validate: {
            validator: function(ids) {
                return ids.length > 0 && ids.length <= this.options.length;
            },
            message: "Must have at least one correct option"
        }
    },
    explanation: {
        type: String,
        default: ""
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

export const Question = mongoose.models.Question || mongoose.model("Question", questionSchema);
