import { describe, it, expect } from "vitest";
import { detectLanguage, pickLocalizedMessage } from "@/lib/language-detector";

describe("language-detector", () => {
    it("returns en for English-only text", () => {
        expect(detectLanguage("Where does photosynthesis occur?")).toBe("en");
    });

    it("returns ar when Arabic script exceeds 30% of characters", () => {
        expect(detectLanguage("أين تحدث عملية البناء الضوئي؟")).toBe("ar");
    });

    it("returns en for empty or whitespace input", () => {
        expect(detectLanguage("")).toBe("en");
        expect(detectLanguage("   ")).toBe("en");
    });

    it("returns en for mixed text below Arabic threshold", () => {
        expect(detectLanguage("Hello world this is an English sentence with one word: test")).toBe("en");
    });

    it("pickLocalizedMessage selects the correct locale", () => {
        const messages = {
            en: "English message",
            ar: "رسالة عربية"
        };
        expect(pickLocalizedMessage(messages, "en")).toBe("English message");
        expect(pickLocalizedMessage(messages, "ar")).toBe("رسالة عربية");
    });
});
