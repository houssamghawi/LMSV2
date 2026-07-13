import mongoose,{Schema} from "mongoose";

const lessonSchema = new Schema({
    title:{
        required: true,
        type: String
    },
    description:{
        required: false,
        type: String
    },
    duration:{
        required: true,
        default: 0,
        type: Number
    },
    video_url:{
        required: false,
        type: String
    },
    // Local video upload fields
    videoProvider: {
        required: false,
        type: String,
        enum: ['local', 'external'],
        default: 'external'
    },
    videoFilename: {
        required: false,
        type: String
    },
    videoUrl: {
        required: false,
        type: String
    },
    videoMimeType: {
        required: false,
        type: String
    },
    videoSize: {
        required: false,
        type: Number
    },    
    active:{
        required: true,
        default: false,
        type: Boolean
    },    
    slug:{
        required: true,
        type: String
    },
    access:{
        required: true,
        default: "private",
        type: String
    },
    order:{
        required: true, 
        type: Number
    },
    tutorEmbeddingStatus: {
        type: String,
        enum: ["none", "pending", "ready", "failed"],
        default: "none"
    },
    tutorContentHash: {
        type: String,
        default: null
    },
    tutorEmbeddedAt: {
        type: Date,
        default: null
    },
    tutorEmbeddingError: {
        type: String,
        default: null
    },
    docxFilename: {
        type: String,
        default: null
    },
    docxOriginalName: {
        type: String,
        default: null
    },
    docxSize: {
        type: Number,
        default: null
    },
    docxUploadedAt: {
        type: Date,
        default: null
    },
    extractedHtml: {
        type: String,
        default: null
    },
    extractedText: {
        type: String,
        default: null
    }
     
});
export const Lesson = mongoose.models.Lesson ?? mongoose.model("Lesson",lessonSchema);