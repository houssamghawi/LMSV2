import mongoose, { Schema } from "mongoose";

const tutorConfigSchema = new Schema({
    courseId: {
        type: Schema.Types.ObjectId,
        ref: "Course",
        default: null,
        index: true,
        unique: true,
        sparse: true
    },
    outOfContextMessage: {
        en: {
            type: String,
            default:
                "I cannot find the answer to your question in the lecture materials. Please refer to your instructor or course resources."
        },
        ar: {
            type: String,
            default:
                "لا أستطيع العثور على إجابة لسؤالك في مواد المحاضرة. يرجى الرجوع إلى المدرس أو موارد الدورة."
        }
    },
    enabled: {
        type: Boolean,
        default: true
    },
    rateLimitPerHour: {
        type: Number,
        default: 20,
        min: 1,
        max: 100
    },
    relevanceThreshold: {
        type: Number,
        default: 0.55,
        min: 0.5,
        max: 0.95
    },
    maxContextChunks: {
        type: Number,
        default: 5,
        min: 1,
        max: 10
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

tutorConfigSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

export const TutorConfiguration =
    mongoose.models.TutorConfiguration ||
    mongoose.model("TutorConfiguration", tutorConfigSchema);
