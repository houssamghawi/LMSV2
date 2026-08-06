import mongoose, { Schema } from "mongoose";

// Embedded sub-schema for the AI-generated question draft stored on the job
// before the instructor saves it to the Quiz/Question store (data-model.md §1).
const draftOptionSchema = new Schema(
    {
        id: { type: String, required: true },
        text: { type: String, required: true }
    },
    { _id: false }
);

const draftQuestionSchema = new Schema(
    {
        draftId: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ["single", "true_false"],
            required: true
        },
        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            required: true
        },
        text: {
            type: String,
            required: true,
            trim: true
        },
        options: {
            type: [draftOptionSchema],
            default: [],
            validate: {
                validator: function (options) {
                    return options.length >= 2;
                },
                message: "MCQ/TF questions need ≥2 options"
            }
        },
        correctOptionIds: {
            type: [String],
            default: [],
            validate: {
                validator: function (ids) {
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
        modelAnswer: {
            type: String,
            default: ""
        },
        explanation: {
            type: String,
            required: true,
            default: ""
        },
        sourceQuote: {
            type: String,
            default: ""
        },
        instructorState: {
            type: String,
            enum: ["untouched", "edited", "approved", "rejected", "regenerated"],
            default: "untouched"
        }
    },
    { _id: false }
);

// Generation parameters captured per job (data-model.md §1 params sub-schema).
const generationParamsSchema = new Schema(
    {
        totalQuestions: { type: Number, required: true, default: 10, min: 1 },
        mcqCount: { type: Number, required: true, default: 5, min: 0 },
        trueFalseCount: { type: Number, required: true, default: 5, min: 0 },
        easyCount: { type: Number, default: 4, min: 0 },
        mediumCount: { type: Number, default: 4, min: 0 },
        hardCount: { type: Number, default: 2, min: 0 }
    },
    { _id: false }
);

// spec 002 — MCQ complement validation summary (data-model.md §1, contracts §2).
// Stored only on mcq_complement jobs after generateQuizDraft + validateMcqStructure
// + filterDuplicateStems run. Defaults make the field optional for full_quiz jobs.
const mcqValidationSummarySchema = new Schema(
    {
        generated: { type: Number, default: 0 },
        droppedUngrounded: { type: Number, default: 0 },
        droppedInvalidStructure: { type: Number, default: 0 },
        droppedDuplicate: { type: Number, default: 0 },
        included: { type: Number, default: 0 }
    },
    { _id: false }
);

const generationJobSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        courseId: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true
        },
        lessonId: {
            type: Schema.Types.ObjectId,
            ref: "Lesson",
            default: null
        },
        // spec 002 — target quiz for MCQ complement jobs. Null for spec 001
        // full-quiz jobs. When non-null, references the existing Quiz that
        // approved MCQs will be appended to via the append endpoint.
        targetQuizId: {
            type: Schema.Types.ObjectId,
            ref: "Quiz",
            default: null
        },
        // spec 002 — discriminator between spec 001 (create new quiz) and
        // spec 002 (append MCQs to existing quiz). Defaults preserve spec 001
        // behavior for all pre-existing jobs and code paths.
        jobType: {
            type: String,
            enum: ["full_quiz", "mcq_complement"],
            required: true,
            default: "full_quiz"
        },
        status: {
            type: String,
            enum: ["queued", "running", "succeeded", "failed"],
            required: true,
            default: "queued"
        },
        failureReason: {
            type: String,
            default: null
        },
        sourceFilename: {
            type: String,
            required: true
        },
        sourceByteSize: {
            type: Number,
            required: true
        },
        sourceContentHash: {
            type: String,
            // Required for jobs that reached the extraction stage. Relaxed so
            // quota-blocked audit records (which never extract text) can be
            // persisted with a null hash — see jobs POST route.
            required: false,
            default: null
        },
        extractedTextLength: {
            type: Number,
            default: null
        },
        extractionWarnings: {
            type: [String],
            default: []
        },
        params: {
            type: generationParamsSchema,
            required: true
        },
        aiProvider: {
            type: String,
            default: null
        },
        aiModel: {
            type: String,
            default: null
        },
        aiTokensInput: {
            type: Number,
            default: null
        },
        aiTokensOutput: {
            type: Number,
            default: null
        },
        consentVersion: {
            type: String,
            required: true
        },
        draftQuestions: {
            type: [draftQuestionSchema],
            default: []
        },
        // spec 002 — validation summary for MCQ complement jobs. Captured after
        // generateQuizDraft + validateMcqStructure + filterDuplicateStems run.
        // Defaults to zeroed fields so full-quiz jobs (spec 001) and jobs that
        // have not yet reached the validation stage still serialize cleanly.
        // The poll endpoint only includes this in the response when
        // jobType === "mcq_complement" (contracts/mcq-complement-api.md §2).
        mcqValidationSummary: {
            type: mcqValidationSummarySchema,
            default: () => ({
                generated: 0,
                droppedUngrounded: 0,
                droppedInvalidStructure: 0,
                droppedDuplicate: 0,
                included: 0
            })
        },
        startedAt: {
            type: Date,
            default: null
        },
        completedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Indexes per data-model.md §1
generationJobSchema.index({ userId: 1, createdAt: -1 });
generationJobSchema.index({ courseId: 1, sourceContentHash: 1 });
generationJobSchema.index({ status: 1 });
generationJobSchema.index({ courseId: 1, lessonId: 1, createdAt: -1 });
// spec 002 — lookup of complement jobs for a specific quiz (audit view,
// concurrent-request detection). Partial index keeps it small: only jobs
// that actually target a quiz are indexed (spec 001 full-quiz jobs have
// targetQuizId === null and are excluded).
generationJobSchema.index(
    { targetQuizId: 1, createdAt: -1 },
    { partialFilterExpression: { targetQuizId: { $ne: null } } }
);

export const GenerationJob =
    mongoose.models.GenerationJob ||
    mongoose.model("GenerationJob", generationJobSchema);
