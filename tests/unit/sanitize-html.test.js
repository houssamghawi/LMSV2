import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize-html";

describe("sanitizeHtml", () => {
    it("preserves allowed mammoth tags", () => {
        const html = "<h2>Title</h2><p>Hello <strong>world</strong></p>";
        expect(sanitizeHtml(html)).toContain("<h2>");
        expect(sanitizeHtml(html)).toContain("<strong>");
    });

    it("strips script tags and event handlers", () => {
        const malicious =
            '<p onclick="alert(1)">Safe</p><script>alert("xss")</script>';
        const result = sanitizeHtml(malicious);
        expect(result).not.toContain("<script");
        expect(result).not.toContain("onclick");
        expect(result).toContain("Safe");
    });

    it("allows img src and alt attributes", () => {
        const html =
            '<img src="/api/lesson-images/abc/photo.png" alt="Diagram" />';
        const result = sanitizeHtml(html);
        expect(result).toContain('src="/api/lesson-images/abc/photo.png"');
        expect(result).toContain('alt="Diagram"');
    });
});
