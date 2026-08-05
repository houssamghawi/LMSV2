/**
 * Mongoose field projections for lesson queries (spec 004-docx-lesson-source).
 * Keeps instructor modal and student lesson page payloads explicit.
 */

export const LESSON_DOCX_FIELDS = [
    "docxFilename",
    "docxOriginalName",
    "docxSize",
    "docxUploadedAt",
    "extractedHtml",
    "extractedText"
];

export const LESSON_EDITOR_FIELDS = [
    "title",
    "slug",
    "description",
    "order",
    "access",
    "active",
    "duration",
    "video_url",
    "videoProvider",
    "videoFilename",
    "videoUrl",
    "videoMimeType",
    "videoSize",
    "tutorEmbeddingStatus",
    "tutorEmbeddedAt",
    "tutorEmbeddingError",
    ...LESSON_DOCX_FIELDS
].join(" ");

export const LESSON_STUDENT_PAGE_FIELDS = [
    "title",
    "slug",
    "description",
    "order",
    "access",
    "active",
    "duration",
    "video_url",
    "videoProvider",
    "videoFilename",
    "videoUrl",
    "videoMimeType",
    "videoSize",
    "docxFilename",
    "extractedHtml",
    "extractedText"
].join(" ");
