import { describe, it, expect } from "vitest";
import JSZip from "jszip";

import { validateDocxBuffer } from "@/service/docx-validator";

async function buildMinimalDocx(extraEntries = {}) {
    const zip = new JSZip();
    zip.file(
        "[Content_Types].xml",
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
    );
    zip.file(
        "word/document.xml",
        '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>'
    );
    for (const [path, content] of Object.entries(extraEntries)) {
        zip.file(path, content);
    }
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("docx-validator", () => {
    it("rejects empty or missing buffers", async () => {
        await expect(validateDocxBuffer(Buffer.alloc(0))).rejects.toMatchObject({
            code: "INVALID_BUFFER"
        });
        await expect(validateDocxBuffer(null)).rejects.toMatchObject({
            code: "INVALID_BUFFER"
        });
    });

    it("rejects non-ZIP data", async () => {
        await expect(validateDocxBuffer(Buffer.from("not-a-docx"))).rejects.toMatchObject({
            code: "INVALID_OOXML"
        });
    });

    it("rejects archives missing required OOXML entries", async () => {
        const zip = new JSZip();
        zip.file("readme.txt", "hello");
        const buffer = await zip.generateAsync({ type: "nodebuffer" });

        await expect(validateDocxBuffer(buffer)).rejects.toMatchObject({
            code: "INVALID_OOXML"
        });
    });

    it("accepts a minimal valid .docx buffer", async () => {
        const buffer = await buildMinimalDocx();
        const result = await validateDocxBuffer(buffer);
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.byteLength).toBeGreaterThan(0);
    });

    it("strips VBA macro entries from a .docx buffer", async () => {
        const buffer = await buildMinimalDocx({
            "word/vbaProject.bin": "macro-bytes",
            "word/vbaData.xml": "<vba/>"
        });
        const result = await validateDocxBuffer(buffer);
        const zip = await JSZip.loadAsync(result);
        const names = Object.keys(zip.files).map((n) => n.toLowerCase());
        expect(names).not.toContain("word/vbaproject.bin");
        expect(names).not.toContain("word/vbadata.xml");
        expect(names).toContain("[content_types].xml");
        expect(names).toContain("word/document.xml");
    });
});
