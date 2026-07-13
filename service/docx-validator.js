import JSZip from "jszip";

// DOCX validation service (research.md §3).
//
// validateDocxBuffer(buffer) → sanitized Buffer
//   1. OOXML structure check via ZIP entry inspection
//   2. Macro detection and stripping of word/vbaProject.bin / word/vbaData.xml
//   3. Returns a sanitized buffer safe for mammoth extraction
//
// MIME type validation is performed by the upload route (DOCX_MIME_TYPE).

const REQUIRED_ENTRIES = ["[Content_Types].xml", "word/document.xml"];
const MACRO_ENTRIES = ["word/vbaProject.bin", "word/vbaData.xml"];
const ZIP_MAGIC = [0x50, 0x4b]; // PK

/**
 * @param {Buffer|Uint8Array} buffer
 * @returns {boolean}
 */
function isValidBuffer(buffer) {
    return (
        buffer !== null &&
        typeof buffer !== "undefined" &&
        (buffer instanceof Buffer || buffer instanceof Uint8Array) &&
        buffer.byteLength > 0
    );
}

/**
 * @param {Buffer|Uint8Array} buffer
 * @returns {boolean}
 */
function hasZipMagic(buffer) {
    return buffer[0] === ZIP_MAGIC[0] && buffer[1] === ZIP_MAGIC[1];
}

/**
 * Case-insensitive ZIP entry lookup (OOXML paths are case-sensitive in spec,
 * but we normalize for defensive matching).
 *
 * @param {JSZip} zip
 * @param {string} entryPath
 * @returns {boolean}
 */
function zipHasEntry(zip, entryPath) {
    const target = entryPath.toLowerCase();
    return Object.keys(zip.files).some((name) => {
        const normalized = name.replace(/\\/g, "/").toLowerCase();
        return normalized === target;
    });
}

/**
 * Validate a .docx buffer and return a macro-stripped copy.
 *
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<Buffer>}
 * @throws {Error} with code INVALID_BUFFER | INVALID_OOXML | ZIP_PARSE_FAILED
 */
export async function validateDocxBuffer(buffer) {
    if (!isValidBuffer(buffer)) {
        const err = new Error("Invalid .docx buffer: expected a non-empty Buffer");
        err.code = "INVALID_BUFFER";
        throw err;
    }

    if (!hasZipMagic(buffer)) {
        const err = new Error("Invalid .docx file: not a valid ZIP/OOXML archive.");
        err.code = "INVALID_OOXML";
        throw err;
    }

    let zip;
    try {
        zip = await JSZip.loadAsync(buffer);
    } catch (cause) {
        const err = new Error("Failed to read .docx archive. The file may be corrupt.");
        err.code = "ZIP_PARSE_FAILED";
        err.cause = cause;
        throw err;
    }

    for (const required of REQUIRED_ENTRIES) {
        if (!zipHasEntry(zip, required)) {
            const err = new Error(
                `Invalid .docx file: required OOXML entry "${required}" is missing.`
            );
            err.code = "INVALID_OOXML";
            throw err;
        }
    }

    let macrosStripped = false;
    for (const macroPath of MACRO_ENTRIES) {
        const entryName = Object.keys(zip.files).find((name) => {
            const normalized = name.replace(/\\/g, "/").toLowerCase();
            return normalized === macroPath.toLowerCase();
        });
        if (entryName) {
            zip.remove(entryName);
            macrosStripped = true;
        }
    }

    if (!macrosStripped) {
        return Buffer.from(buffer);
    }

    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
