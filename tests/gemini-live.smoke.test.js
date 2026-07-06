import { describe, it, expect } from "vitest";

import { generateQuizDraft } from "@/service/quiz-generator";

const SAMPLE_TEXT = `
Photosynthesis is the process by which green plants convert light energy into chemical energy.
Chlorophyll in plant leaves absorbs sunlight. During photosynthesis, plants take in carbon dioxide
from the air and release oxygen. This process is essential for life on Earth because it produces
the oxygen animals breathe.
`.trim();

const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());

function buildParams(totalQuestions) {
    const mcqCount = Math.ceil(totalQuestions / 2);
    const trueFalseCount = totalQuestions - mcqCount;
    const easyCount = Math.ceil(totalQuestions / 3);
    const mediumCount = Math.ceil((totalQuestions - easyCount) / 2);
    const hardCount = Math.max(0, totalQuestions - easyCount - mediumCount);
    return {
        totalQuestions,
        mcqCount,
        trueFalseCount,
        easyCount,
        mediumCount,
        hardCount
    };
}

describe.skipIf(!hasGeminiKey)("Gemini live smoke (requires GEMINI_API_KEY)", () => {
    for (const count of [1, 5, 10, 20]) {
        it(
            `generates exactly ${count} MCQ and true/false questions`,
            async () => {
                const params = buildParams(count);
                const result = await generateQuizDraft(SAMPLE_TEXT, params);
                expect(result.provider).toBe("google-gemini");
                expect(result.model).toMatch(/gemini-2\.5/);
                expect(result.questions).toHaveLength(count);

                const types = new Set(result.questions.map((q) => q.type));
                expect(types.has("short_answer")).toBe(false);
                expect(types.has("essay")).toBe(false);

                const texts = result.questions.map((q) => q.text.trim().toLowerCase());
                expect(new Set(texts).size).toBe(texts.length);

                for (const q of result.questions) {
                    expect(q.text).toBeTruthy();
                    expect(q.explanation).toBeTruthy();
                    expect(["single", "true_false"]).toContain(q.type);
                    if (q.type === "single") {
                        expect(q.correctOptionIds.length).toBeGreaterThan(0);
                    }
                }
            },
            120000
        );
    }
});
