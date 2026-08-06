import mongoose,{Schema} from "mongoose";

const enrollmentSchema = new Schema({ 
    enrollment_date:{
        required: true,
        type: Date,
        default: Date.now
    },    
    status:{
        required: true,
        type: String,
        enum: ['not-started', 'in-progress', 'completed'],
        default: 'not-started'
    },
    completion_date:{
        required: false,
        type: Date
    },
    method:{
        required: true,
        type: String,
        enum: ['stripe', 'free', 'manual', 'mockpay'],
        default: 'stripe'
    },
    course:{  
        type: Schema.ObjectId, 
        ref: "Course",
        required: true,
        index: true
    },
    student:{  
        type: Schema.ObjectId, 
        ref: "User",
        required: true,
        index: true
    },
    payment: {
        type: Schema.ObjectId,
        ref: "Payment"
    }
});

// Unique constraint: one enrollment per student per course
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

// Index for course queries
enrollmentSchema.index({ course: 1, enrollment_date: -1 });

// Index for student queries
enrollmentSchema.index({ student: 1, enrollment_date: -1 });

export const Enrollment = mongoose.models.Enrollment ?? mongoose.model("Enrollment",enrollmentSchema);
