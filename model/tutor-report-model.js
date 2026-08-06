import mongoose, { Schema } from "mongoose";

const tutorReportSchema = new Schema({
    interactionId: {
        type: Schema.Types.ObjectId,
        ref: "TutorInteraction",
        required: true,
        index: true
    },
    studentId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    reason: {
        type: String,
        required: true,
        enum: ["incorrect", "inappropriate", "other"]
    },
    details: {
        type: String,
        maxlength: 500,
        default: null
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    }
});

tutorReportSchema.index({ interactionId: 1, studentId: 1 }, { unique: true });

export const TutorReport =
    mongoose.models.TutorReport ||
    mongoose.model("TutorReport", tutorReportSchema);
