import { detectLanguage } from "@/lib/language-detector";

/**
 * Resolve text direction for tutor chat bubbles.
 * Message chrome uses LTR layout; Arabic tutor answers render RTL inside.
 *
 * @param {object} params
 * @param {"student" | "tutor"} params.role
 * @param {"ar" | "en" | null | undefined} [params.language]
 * @param {string} [params.content]
 */
export function resolveChatTextLayout({ role, language, content = "" }) {
    const resolvedLanguage = language ?? detectLanguage(content);
    const isArabicAnswer = role === "tutor" && resolvedLanguage === "ar";

    return {
        language: resolvedLanguage,
        messageDir: "ltr",
        textDir: isArabicAnswer ? "rtl" : "auto",
        textClassName: isArabicAnswer ? "text-right" : ""
    };
}
