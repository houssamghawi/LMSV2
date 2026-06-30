import mammoth from "mammoth";
import { createHash } from "node:crypto";

// DOCX text extraction service (research.md §2, FR-002).
//
// extractDocxText(buffer) → { text, warnings, byteSize }
//   - Extracts plain text from a .docx buffer via mammoth.extractRawText.
//   - Normalizes the result: NFKC Unicode normalization + collapse all
//     whitespace runs to single spaces + trim. This prevents false-negative
//     duplicate detection when Word re-saves the same content (research.md §3).
//   - Surfaces mammoth warnings (skipped equations/footnotes/etc.) as a
//     passthrough array so the route can return them to the client (contracts §3).
//
// computeContentHash(normalizedText) → sha256 hex
//   - SHA-256 of the normalized text. Used for dedup (courseId + hash) and
//     as the audit fingerprint (FR-013). Empty text hashes to a stable value;
//     callers must reject empty text BEFORE hashing per FR-002.
//
// All functions are pure and side-effect free except mammoth I/O.

/**
 * Validate that a buffer is a non-empty Buffer/Uint8Array.
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
 * Normalize extracted text: NFKC + collapse whitespace + trim.
 * Matches the research.md §3 decision to prevent duplicate-hash false
 * negatives across Word re-saves of the same content.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeText(raw) {
    if (!raw) return "";
    // NFKC normalization via String.normalize. Collapses compatibility
    // characters (e.g. fullwidth ASCII, ligatures) to canonical forms.
    const nfkc = String(raw).normalize("NFKC");
    // Collapse all whitespace runs (spaces, tabs, newlines, NBSP, etc.)
    // to a single space and trim. \s in JS covers \t\n\r\f\v and space;
    // we also strip non-breaking spaces explicitly.
    return nfkc
        .replace(/[\u00A0\u2007\u202F]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Compute the SHA-256 content hash of normalized extracted text.
 * @param {string} normalizedText
 * @returns {string} 64-char lowercase hex digest
 */
export function computeContentHash(normalizedText) {
    return createHash("sha256").update(normalizedText || "").digest("hex");
}

/**
 * Extract plain text from a .docx buffer.
 *
 * @param {Buffer|Uint8Array} buffer - raw .docx bytes
 * @returns {Promise<{ text: string, warnings: string[], byteSize: number }>}
 *   - text: normalized plain text (may be empty for image-only/scanned docs)
 *   - warnings: mammoth warning messages (skipped elements, unsupported features)
 *   - byteSize: size of the input buffer in bytes
 * @throws {Error} if the buffer is invalid or mammoth fails to parse the file
 *   (corrupt or password-protected .docx). The caller maps the error to the
 *   appropriate HTTP response (FR-002, edge case 6a).
 */
export async function extractDocxText(buffer) {
    if (!isValidBuffer(buffer)) {
        const err = new Error("Invalid .docx buffer: expected a non-empty Buffer");
        err.code = "INVALID_BUFFER";
        throw err;
    }

    let result;
    try {
        result = await mammoth.extractRawText({ buffer });
    } catch (cause) {
        const err = new Error("Failed to parse .docx file. The file may be corrupt or password-protected.");
        err.code = "DOCX_PARSE_FAILED";
        err.cause = cause;
        throw err;
    }

    const rawText = result?.value ?? "";
    const warnings = Array.isArray(result?.messages)
        ? result.messages.map((m) => m?.message || String(m)).filter(Boolean)
        : [];

    return {
        text: normalizeText(rawText),
        warnings,
        byteSize: buffer.byteLength
    };
}
