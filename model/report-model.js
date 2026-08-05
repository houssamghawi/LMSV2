import mongoose,{Schema} from "mongoose";

const reportSchema = new Schema({ 
    totalCompletedLessons:{
        required: true,
        type: Array,
        default: []
    },    
    totalCompletedModules:{
        required: true,
        type: Array,
        default: []
    },    
    course:{  type: Schema.ObjectId, ref: "Course" },

    student:{  type: Schema.ObjectId, ref: "User" },

    quizAssessment:{  type: Schema.ObjectId, ref: "Assessment" },
    // Quiz v2 tracking
    passedQuizIds: [{
        type: Schema.Types.ObjectId,
        ref: "Quiz"
    }],
    latestQuizAttemptByQuiz: {
        type: Map,
        of: String,
        default: {}
    },
    completion_date: {
        required: false,
        type: Date
    }
 
});

// Add unique index on course + student to prevent duplicates
reportSchema.index({ course: 1, student: 1 }, { unique: true });

// Virtual getter for backward compatibility with old field name
reportSchema.virtual('totalCompletedModeules').get(function() {
    return this.totalCompletedModules;
});

// Setter for backward compatibility - writes to new field
reportSchema.virtual('totalCompletedModeules').set(function(value) {
    this.totalCompletedModules = value;
});

// Ensure virtuals are included in toJSON/toObject
reportSchema.set('toJSON', { virtuals: true });
reportSchema.set('toObject', { virtuals: true });

export const Report = mongoose.models.Report ?? mongoose.model("Report",reportSchema);