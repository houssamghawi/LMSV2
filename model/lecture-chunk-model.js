import mongoose, { Schema } from "mongoose";

const lectureChunkSchema = new Schema({
    chromaId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    lessonId: {
        type: Schema.Types.ObjectId,
        ref: "Lesson",
        required: true,
        index: true
    },
    courseId: {
        type: Schema.Types.ObjectId,
        ref: "Course",
        required: true,
        index: true
    },
    chunkIndex: {
        type: Number,
        required: true
    },
    startOffset: {
        type: Number,
        required: true
    },
    endOffset: {
        type: Number,
        required: true
    },
    tokenCount: {
        type: Number,
        required: true
    },
    contentHash: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    embeddedAt: {
        type: Date,
        required: true,
        default: Date.now
    }
});

lectureChunkSchema.index({ lessonId: 1, chunkIndex: 1 });

export const LectureChunk =
    mongoose.models.LectureChunk ||
    mongoose.model("LectureChunk", lectureChunkSchema);
