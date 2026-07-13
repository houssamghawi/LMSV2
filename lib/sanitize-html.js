import DOMPurify from "isomorphic-dompurify";

import { DOCX_ALLOWED_TAGS } from "./constants.js";

const ALLOWED_ATTR = ["src", "href", "alt", "class", "dir"];

/**
 * Sanitize mammoth-produced (or legacy) HTML for safe rendering in the Lecture section.
 * Whitelists tags from DOCX_ALLOWED_TAGS and a minimal attribute set.
 *
 * @param {string} html
 * @returns {string}
 */
export function sanitizeHtml(html) {
    if (!html) return "";

    return DOMPurify.sanitize(String(html), {
        ALLOWED_TAGS: DOCX_ALLOWED_TAGS,
        ALLOWED_ATTR
    });
}
