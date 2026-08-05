import mongoose, { Schema } from "mongoose";

// Tracks per-user acknowledgement of the third-party AI processing banner (FR-022).
// Unique compound index on (userId, consentVersion) makes "has user consented to
// current version?" a fast lookup and prevents duplicate acknowledgements.
const aiProcessingConsentSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        consentVersion: {
            type: String,
            required: true,
            trim: true
        },
        acknowledgedAt: {
            type: Date,
            required: true,
            default: Date.now
        },
        userAgent: {
            type: String,
            default: null
        }
    },
    {
        timestamps: { createdAt: true, updatedAt: false }
    }
);

aiProcessingConsentSchema.index(
    { userId: 1, consentVersion: 1 },
    { unique: true }
);

export const AIProcessingConsent =
    mongoose.models.AIProcessingConsent ||
    mongoose.model("AIProcessingConsent", aiProcessingConsentSchema);
