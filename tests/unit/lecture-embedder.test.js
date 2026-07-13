// Unit tests: lecture content extraction and chunking (T048).
import { describe, it, expect } from "vitest";
import {
    extractLessonContent,
    stripHtmlContent,
    chunkText,
    hashContent
} from "@/service/lecture-embedder";

describe("extractLessonContent (T048)", () => {
    it("returns plain text from HTML description", () => {
        const html =
            "<p>Photosynthesis occurs in <strong>chloroplasts</strong>.</p>";
        expect(extractLessonContent(html)).toBe(
            "Photosynthesis occurs in chloroplasts."
        );
    });

    it("extracts from lesson object description field (legacy)", () => {
        expect(
            extractLessonContent({
                description: "<p>Cell division happens in mitosis.</p>"
            })
        ).toBe("Cell division happens in mitosis.");
    });

    it("prefers extractedText over legacy description", () => {
        expect(
            extractLessonContent({
                extractedText: "File-based lecture content about mitosis.",
                description: "<p>Legacy description about photosynthesis.</p>"
            })
        ).toBe("File-based lecture content about mitosis.");
    });

    it("uses extractedText when docxFilename is set and ignores description", () => {
        expect(
            extractLessonContent({
                docxFilename: "507f1f77bcf86cd799439011.docx",
                extractedText: "Uploaded lecture text.",
                description: "<p>Old description should not be used.</p>"
            })
        ).toBe("Uploaded lecture text.");
    });

    it("returns empty when docxFilename is set but extractedText is empty", () => {
        expect(
            extractLessonContent({
                docxFilename: "507f1f77bcf86cd799439011.docx",
                extractedText: null,
                description: "<p>Legacy description must not resurrect.</p>"
            })
        ).toBe("");
    });

    it("returns empty string for blank content", () => {
        expect(extractLessonContent("")).toBe("");
        expect(extractLessonContent({ description: "   " })).toBe("");
        expect(extractLessonContent(null)).toBe("");
    });

    it("stripHtmlContent decodes common entities", () => {
        expect(stripHtmlContent("A &amp; B")).toBe("A & B");
    });
});

describe("chunkText", () => {
    it("splits long text into multiple chunks", () => {
        const text = "word ".repeat(600).trim();
        const chunks = chunkText(text);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks[0].chunkIndex).toBe(0);
    });

    it("returns empty array for empty input", () => {
        expect(chunkText("")).toEqual([]);
    });
});

describe("hashContent", () => {
    it("produces stable hashes", () => {
        expect(hashContent("hello")).toBe(hashContent("hello"));
        expect(hashContent("hello")).not.toBe(hashContent("world"));
    });
});
