# Data Model: Context-Bound AI Tutor

**Feature**: 003-context-bound-ai-tutor  
**Date**: 2026-07-06  
**Status**: Complete

## Overview

This document defines the data entities for the context-bound AI tutor feature. All models follow existing LMS patterns using Mongoose schemas with proper references and indexes.

---

## Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Course      │     │     Lesson      │     │      User       │
│  (existing)     │     │   (existing)    │     │   (existing)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1:N                   │ 1:N                   │ 1:N
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ TutorConfig     │     │  LectureChunk   │     │TutorInteraction │
│   (NEW)         │     │    (NEW)        │     │    (NEW)        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                │ metadata ref
                                ▼
                        ┌─────────────────┐
                        │   ChromaDB      │
                        │  (vector store) │
                        └─────────────────┘
```

---

## 1. TutorInteraction

Represents a single Q&A exchange between a student and the AI tutor.

### Schema Definition

```javascript
// model/tutor-interaction-model.js
import mongoose, { Schema } from "mongoose";

const tutorInteractionSchema = new Schema({
  // Question details
  question: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  // Response details
  response: {
    type: String,
    required: true
  },
  
  citation: {
    type: String,
    default: null
  },
  
  // Context tracking
  contextStatus: {
    type: String,
    required: true,
    enum: ["answered", "out_of_context"],
    index: true
  },
  
  contextChunkIds: [{
    type: String  // ChromaDB chunk IDs used for this response
  }],
  
  // Language
  detectedLanguage: {
    type: String,
    required: true,
    enum: ["ar", "en"]
  },
  
  // References
  studentId: {
    type: Schema.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  
  courseId: {
    type: Schema.ObjectId,
    ref: "Course",
    required: true,
    index: true
  },
  
  lessonId: {
    type: Schema.ObjectId,
    ref: "Lesson",
    required: true,
    index: true
  },
  
  // Optional feedback
  feedback: {
    type: String,
    enum: ["helpful", "not_helpful", null],
    default: null
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  // Metadata for debugging/analytics
  metadata: {
    modelUsed: String,
    tokensInput: Number,
    tokensOutput: Number,
    responseTimeMs: Number,
    relevanceScores: [Number]
  }
});

// Compound indexes for common queries
tutorInteractionSchema.index({ lessonId: 1, studentId: 1, createdAt: -1 });
tutorInteractionSchema.index({ courseId: 1, contextStatus: 1, createdAt: -1 });

export const TutorInteraction = mongoose.models.TutorInteraction 
  ?? mongoose.model("TutorInteraction", tutorInteractionSchema);
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | String | Yes | Student's question (max 1000 chars) |
| `response` | String | Yes | AI tutor's response |
| `citation` | String | No | Quoted source text from lecture |
| `contextStatus` | Enum | Yes | "answered" or "out_of_context" |
| `contextChunkIds` | [String] | No | ChromaDB IDs of chunks used |
| `detectedLanguage` | Enum | Yes | "ar" or "en" |
| `studentId` | ObjectId | Yes | Reference to User (student) |
| `courseId` | ObjectId | Yes | Reference to Course |
| `lessonId` | ObjectId | Yes | Reference to Lesson |
| `feedback` | Enum | No | Optional student feedback |
| `createdAt` | Date | Yes | Timestamp for retention tracking |
| `metadata` | Object | No | Debugging/analytics data |

### Lifecycle

- **Created**: When student submits a question
- **Updated**: When student provides feedback (thumbs up/down)
- **Deleted**: Automatically after course completion + 1 year (via cleanup job)

---

## 2. TutorConfiguration

Stores institution-level or course-level AI tutor settings.

### Schema Definition

```javascript
// model/tutor-config-model.js
import mongoose, { Schema } from "mongoose";

const tutorConfigSchema = new Schema({
  // Scope: null = global default, courseId = course-specific
  courseId: {
    type: Schema.ObjectId,
    ref: "Course",
    default: null,
    index: true,
    unique: true,
    sparse: true  // Allows multiple null values (global config)
  },
  
  // Configurable out-of-context message
  outOfContextMessage: {
    en: {
      type: String,
      default: "I cannot find the answer to your question in the lecture materials. Please refer to your instructor or course resources."
    },
    ar: {
      type: String,
      default: "لا أستطيع العثور على إجابة لسؤالك في مواد المحاضرة. يرجى الرجوع إلى المدرس أو موارد الدورة."
    }
  },
  
  // Feature toggle
  enabled: {
    type: Boolean,
    default: true
  },
  
  // Rate limiting (per student per hour per course)
  rateLimitPerHour: {
    type: Number,
    default: 20,
    min: 1,
    max: 100
  },
  
  // Retrieval settings
  relevanceThreshold: {
    type: Number,
    default: 0.7,
    min: 0.5,
    max: 0.95
  },
  
  maxContextChunks: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  
  // Audit
  updatedBy: {
    type: Schema.ObjectId,
    ref: "User"
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

tutorConfigSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const TutorConfiguration = mongoose.models.TutorConfiguration 
  ?? mongoose.model("TutorConfiguration", tutorConfigSchema);
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `courseId` | ObjectId | No | Course scope (null = global) |
| `outOfContextMessage` | Object | Yes | Localized out-of-context messages |
| `enabled` | Boolean | Yes | Feature toggle |
| `rateLimitPerHour` | Number | Yes | Max questions per student per hour |
| `relevanceThreshold` | Number | Yes | Min similarity score (0.5-0.95) |
| `maxContextChunks` | Number | Yes | Max chunks to include in context |
| `updatedBy` | ObjectId | No | Admin who last updated |
| `updatedAt` | Date | Yes | Last modification timestamp |

### Configuration Resolution

1. Check for course-specific config (`courseId` match)
2. Fall back to global config (`courseId: null`)
3. Fall back to schema defaults

---

## 3. LectureChunk

Metadata record for lecture content chunks stored in ChromaDB.

### Schema Definition

```javascript
// model/lecture-chunk-model.js
import mongoose, { Schema } from "mongoose";

const lectureChunkSchema = new Schema({
  // ChromaDB reference
  chromaId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Source reference
  lessonId: {
    type: Schema.ObjectId,
    ref: "Lesson",
    required: true,
    index: true
  },
  
  courseId: {
    type: Schema.ObjectId,
    ref: "Course",
    required: true,
    index: true
  },
  
  // Chunk metadata
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
  
  // Content hash for change detection
  contentHash: {
    type: String,
    required: true
  },
  
  // Timestamps
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

// Compound index for lesson chunk lookup
lectureChunkSchema.index({ lessonId: 1, chunkIndex: 1 });

export const LectureChunk = mongoose.models.LectureChunk 
  ?? mongoose.model("LectureChunk", lectureChunkSchema);
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chromaId` | String | Yes | Unique ID in ChromaDB |
| `lessonId` | ObjectId | Yes | Source lesson reference |
| `courseId` | ObjectId | Yes | Parent course reference |
| `chunkIndex` | Number | Yes | Position in lesson (0-based) |
| `startOffset` | Number | Yes | Character start position in source |
| `endOffset` | Number | Yes | Character end position in source |
| `tokenCount` | Number | Yes | Token count for context budgeting |
| `contentHash` | String | Yes | SHA-256 of chunk text |
| `createdAt` | Date | Yes | Initial creation timestamp |
| `embeddedAt` | Date | Yes | Last embedding timestamp |

### Lifecycle

- **Created**: When lecture content is uploaded/embedded
- **Updated**: When lecture content changes (re-embedded)
- **Deleted**: When lesson is deleted (cascade from lesson cleanup)

---

## Validation Rules

### TutorInteraction

```javascript
import { z } from "zod";

export const tutorInteractionCreateSchema = z.object({
  question: z.string().min(1).max(1000),
  lessonId: z.string().regex(/^[a-f\d]{24}$/i),
  courseId: z.string().regex(/^[a-f\d]{24}$/i)
});

export const tutorInteractionFeedbackSchema = z.object({
  interactionId: z.string().regex(/^[a-f\d]{24}$/i),
  feedback: z.enum(["helpful", "not_helpful"])
});
```

### TutorConfiguration

```javascript
export const tutorConfigUpdateSchema = z.object({
  outOfContextMessage: z.object({
    en: z.string().min(10).max(500).optional(),
    ar: z.string().min(10).max(500).optional()
  }).optional(),
  enabled: z.boolean().optional(),
  rateLimitPerHour: z.number().int().min(1).max(100).optional(),
  relevanceThreshold: z.number().min(0.5).max(0.95).optional(),
  maxContextChunks: z.number().int().min(1).max(10).optional()
});
```

---

## Migration Notes

### New Collections

1. `tutorinteractions` - Created automatically by Mongoose
2. `tutorconfigurations` - Created automatically by Mongoose
3. `lecturechunks` - Created automatically by Mongoose

### Indexes

All indexes defined in schemas will be created automatically. For production, verify with:

```javascript
await TutorInteraction.syncIndexes();
await TutorConfiguration.syncIndexes();
await LectureChunk.syncIndexes();
```

### Seed Data

Create global default configuration:

```javascript
await TutorConfiguration.findOneAndUpdate(
  { courseId: null },
  { 
    $setOnInsert: {
      outOfContextMessage: {
        en: "I cannot find the answer to your question in the lecture materials. Please refer to your instructor or course resources.",
        ar: "لا أستطيع العثور على إجابة لسؤالك في مواد المحاضرة. يرجى الرجوع إلى المدرس أو موارد الدورة."
      },
      enabled: true,
      rateLimitPerHour: 20,
      relevanceThreshold: 0.7,
      maxContextChunks: 5
    }
  },
  { upsert: true }
);
```
