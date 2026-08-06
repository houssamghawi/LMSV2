import mongoose,{Schema} from "mongoose";

const userSchema = new Schema({
    firstName:{
        required: true,
        type: String,
        trim: true,
        maxlength: 50
    },
    lastName:{
        required: true,
        type: String,
        trim: true,
        maxlength: 50
    },
    password:{
        required: true,
        type: String,
        select: false // Don't return password by default
    },
    email:{
        required: true,
        type: String,
        trim: true,
        lowercase: true,
        unique: true, // Add unique constraint
        index: true, // Add index for faster lookups
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    role:{
        required: true,
        type: String,
        enum: ['admin', 'instructor', 'student'],
        default: 'student'
    },
    phone:{
        required: false,
        type: String
    },
    bio:{
        required: false,
        type: String,
        default: ""
    },
    socialMedia:{
        required: false,
        type: Object
    },   
  
    profilePicture:{
        required: false,
        type: String,
        default: "/assets/images/profile.jpg"
    },
    designation:{
        required: false,
        type: String,
        default: ""
    },
    status: {
        required: false,
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    lastLogin: {
        required: false,
        type: Date
    },
    createdAt: {
        required: false,
        type: Date,
        default: Date.now
    },
    updatedAt: {
        required: false,
        type: Date,
        default: Date.now
    }
});
export const User = mongoose.models.User ?? mongoose.model("User",userSchema);