const ARABIC_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;

/**
 * Detect whether text is primarily Arabic or English using a Unicode heuristic.
 * Returns "ar" when >30% of non-whitespace characters are Arabic script; otherwise "en".
 *
 * @param {string} text
 * @returns {"ar" | "en"}
 */
export function detectLanguage(text) {
    if (!text || typeof text !== "string") {
        return "en";
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return "en";
    }

    const nonWhitespace = trimmed.replace(/\s/g, "");
    if (nonWhitespace.length === 0) {
        return "en";
    }

    const arabicMatches = trimmed.match(ARABIC_PATTERN) || [];
    const ratio = arabicMatches.length / nonWhitespace.length;

    return ratio > 0.3 ? "ar" : "en";
}

/**
 * Pick the localized out-of-context message for the detected language.
 *
 * @param {{ en: string, ar: string }} messages
 * @param {"ar" | "en"} language
 * @returns {string}
 */
export function pickLocalizedMessage(messages, language) {
    if (!messages) return "";
    return language === "ar" ? messages.ar : messages.en;
}
