import { describe, it, expect } from "vitest";

import { generateQuizDraft } from "@/service/quiz-generator";

const SAMPLE_TEXT = `
Photosynthesis is the process by which green plants convert light energy into chemical energy.
Chlorophyll in plant leaves absorbs sunlight. During photosynthesis, plants take in carbon dioxide
from the air and release oxygen. This process is essential for life on Earth because it produces
the oxygen animals breathe.
`.trim();

const PARAMS = {
    totalQuestions: 3,
    mcqCount: 1,
    trueFalseCount: 1,
    shortAnswerCount: 1,
    easyCount: 1,
    mediumCount: 1,
    hardCount: 1
};

const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());

describe.skipIf(!hasGeminiKey)("Gemini live smoke (requires GEMINI_API_KEY)", () => {
    it(
        "generates MCQ, true/false, and short-answer questions",
        async () => {
            const result = await generateQuizDraft(SAMPLE_TEXT, PARAMS);
            expect(result.provider).toBe("google-gemini");
            expect(result.questions.length).toBeGreaterThan(0);

            const types = new Set(result.questions.map((q) => q.type));
            expect(types.has("single")).toBe(true);
            expect(types.has("true_false")).toBe(true);
            expect(types.has("short_answer")).toBe(true);

            for (const q of result.questions) {
                expect(q.text).toBeTruthy();
                expect(q.explanation).toBeTruthy();
                if (q.type === "short_answer") {
                    expect(q.modelAnswer).toBeTruthy();
                }
                if (q.type === "single") {
                    expect(q.correctOptionIds.length).toBeGreaterThan(0);
                }
            }
        },
        60000
    );
});
