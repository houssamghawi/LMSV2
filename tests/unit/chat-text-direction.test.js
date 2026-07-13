import { describe, it, expect } from "vitest";
import { resolveChatTextLayout } from "@/lib/chat-text-direction";

describe("resolveChatTextLayout", () => {
    it("uses RTL answer text inside an LTR message shell for Arabic tutor replies", () => {
        const layout = resolveChatTextLayout({
            role: "tutor",
            language: "ar",
            content: "طبقة المخرجات هي الطبقة الأخيرة في الشبكة."
        });

        expect(layout.messageDir).toBe("ltr");
        expect(layout.textDir).toBe("rtl");
        expect(layout.textClassName).toBe("text-right");
    });

    it("keeps English tutor replies on auto direction", () => {
        const layout = resolveChatTextLayout({
            role: "tutor",
            language: "en",
            content: "Photosynthesis occurs in chloroplasts."
        });

        expect(layout.messageDir).toBe("ltr");
        expect(layout.textDir).toBe("auto");
        expect(layout.textClassName).toBe("");
    });

    it("does not force RTL on student questions", () => {
        const layout = resolveChatTextLayout({
            role: "student",
            language: "ar",
            content: "اشرح لي طبقة المخرجات"
        });

        expect(layout.messageDir).toBe("ltr");
        expect(layout.textDir).toBe("auto");
    });
});
