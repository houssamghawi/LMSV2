import mongoose, { Schema } from "mongoose";

// Admin-tunable settings for quiz generation (FR-012). Singleton pattern:
// at most one document in the collection. Query helpers use `findOne({})`
// and `findOneAndUpdate({}, update, { upsert: true })` to read/mutate it.
const adminQuizConfigSchema = new Schema(
    {
        dailyQuotaPerInstructor: {
            type: Number,
            required: true,
            default: 20,
            min: 1,
            max: 1000
        },
        maxDocumentSizeBytes: {
            type: Number,
            required: true,
            default: 10485760, // 10 MB
            min: 1048576, // 1 MB
            max: 52428800 // 50 MB
        },
        maxQuestionsPerGeneration: {
            type: Number,
            required: true,
            default: 30,
            min: 1,
            max: 50
        },
        sourceRetentionEnabled: {
            type: Boolean,
            required: true,
            default: false
        },
        sourceRetentionDays: {
            type: Number,
            default: 30,
            min: 1,
            max: 365
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

export const AdminQuizConfig =
    mongoose.models.AdminQuizConfig ||
    mongoose.model("AdminQuizConfig", adminQuizConfigSchema);
