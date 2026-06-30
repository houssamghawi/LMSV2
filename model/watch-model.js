import mongoose,{Schema} from "mongoose";

const watchSchema = new Schema({ 
    state:{
        required: true,
        type: String,
        default: "started"
    },    
    created_at:{
        required: true,
        type: Date,
        default: Date.now
    }, 
    modified_at:{
        required: true,
        type: Date,
        default: Date.now
    },  
    lesson:{  type: Schema.ObjectId, ref: "Lesson" },
    module:{  type: Schema.ObjectId, ref: "Module" }, 
    user:{  type: Schema.ObjectId, ref: "User" },
    lastTime:{
        required: true,
        type: Number,
        default: 0
    },  
 
});

// Update modified_at before saving
watchSchema.pre('save', function(next) {
    this.modified_at = new Date();
    next();
});

// Indexes for common query patterns
watchSchema.index({ user: 1, module: 1, state: 1 }); // Common lookup: user's watches in a module
watchSchema.index({ user: 1, lesson: 1 }); // Check if user watched a specific lesson
watchSchema.index({ module: 1, state: 1 }); // Get all completed watches for a module

export const Watch = mongoose.models.Watch ?? mongoose.model("Watch",watchSchema);