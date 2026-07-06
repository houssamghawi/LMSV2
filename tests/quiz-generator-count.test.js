import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const SAMPLE_TEXT =
    "Photosynthesis converts light energy into chemical energy. Plants release oxygen.";

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

function makeMcq(index) {
    return {
        draftId: `mcq-${index}`,
        type: "single",
        difficulty: "easy",
        text: `MCQ question ${index}?`,
        options: [
            { id: "a", text: "A process" },
            { id: "b", text: "A plant" },
            { id: "c", text: "A color" },
            { id: "d", text: "An animal" }
        ],
        correctOptionIds: ["a"],
        modelAnswer: "",
        explanation: "Because photosynthesis is a process.",
        sourceQuote: "Photosynthesis converts light energy into chemical energy.",
        instructorState: "untouched"
    };
}

function makeTf(index) {
    return {
        draftId: `tf-${index}`,
        type: "true_false",
        difficulty: "medium",
        text: `True/false statement ${index}.`,
        options: [
            { id: "t", text: "True" },
            { id: "f", text: "False" }
        ],
        correctOptionIds: ["t"],
        modelAnswer: "",
        explanation: "Plants release oxygen.",
        sourceQuote: "Plants release oxygen.",
        instructorState: "untouched"
    };
}

function makeEssay(index) {
    return {
        draftId: `essay-${index}`,
        type: "essay",
        difficulty: "hard",
        text: `Write an essay about topic ${index}.`,
        options: [],
        correctOptionIds: [],
        modelAnswer: "A long answer.",
        explanation: "Essay prompt.",
        sourceQuote: "Photosynthesis converts light energy into chemical energy.",
        instructorState: "untouched"
    };
}

let geminiResponses = [];
let callCount = 0;

vi.mock("@google/genai", () => ({
    GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: {
            generateContent: vi.fn(async () => {
                const payload = geminiResponses[callCount] ?? geminiResponses[geminiResponses.length - 1];
                callCount += 1;
                return {
                    text: JSON.stringify(payload),
                    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 }
                };
            })
        }
    }))
}));

const { generateQuizDraft, selectQuestionsForMix } = await import("@/service/quiz-generator");

describe("quiz-generator: exact question count enforcement", () => {
    beforeEach(() => {
        geminiResponses = [];
        callCount = 0;
        process.env.GEMINI_API_KEY = "test-key";
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    for (const count of [1, 5, 10, 20]) {
        it(`returns exactly ${count} questions when Gemini over-delivers`, async () => {
            const extra = count + 5;
            const questions = [];
            for (let i = 0; i < extra; i++) {
                questions.push(i % 2 === 0 ? makeMcq(i + 1) : makeTf(i + 1));
            }
            geminiResponses = [{ questions }];

            const result = await generateQuizDraft(SAMPLE_TEXT, buildParams(count));
            expect(result.questions).toHaveLength(count);
            expect(result.questions.every((q) => ["single", "true_false"].includes(q.type))).toBe(true);
        });
    }

    for (const count of [1, 5, 10, 20]) {
        it(`tops up to exactly ${count} when Gemini under-delivers`, async () => {
            const firstBatch = [];
            const half = Math.max(1, Math.floor(count / 2));
            for (let i = 0; i < half; i++) {
                firstBatch.push(i % 2 === 0 ? makeMcq(i + 1) : makeTf(i + 1));
            }

            const topUp = [];
            for (let i = half; i < count; i++) {
                topUp.push(i % 2 === 0 ? makeMcq(i + 100) : makeTf(i + 100));
            }

            geminiResponses = [{ questions: firstBatch }, { questions: topUp }];

            const result = await generateQuizDraft(SAMPLE_TEXT, buildParams(count));
            expect(result.questions).toHaveLength(count);
        });
    }

    it("discards essay questions and tops up until the requested count is met", async () => {
        geminiResponses = [
            {
                questions: [
                    makeEssay(1),
                    makeMcq(1),
                    makeEssay(2)
                ]
            },
            {
                questions: [makeTf(1)]
            }
        ];

        const result = await generateQuizDraft(SAMPLE_TEXT, buildParams(2));
        expect(result.questions).toHaveLength(2);
        expect(result.questions.some((q) => q.type === "essay")).toBe(false);
        expect(result.questions.some((q) => q.text.includes("essay"))).toBe(false);
        expect(new Set(result.questions.map((q) => q.type))).toEqual(
            new Set(["single", "true_false"])
        );
    });

    it("selectQuestionsForMix never returns more than totalQuestions", () => {
        const pool = Array.from({ length: 25 }, (_, i) => makeMcq(i + 1));
        const params = buildParams(1);
        const selected = selectQuestionsForMix(pool, params);
        expect(selected).toHaveLength(1);
    });

    it("does not top up when invalid sourceQuote is stripped but count and mix are satisfied", async () => {
        const questions = [];
        for (let i = 0; i < 10; i++) {
            const q = i % 2 === 0 ? makeMcq(i + 1) : makeTf(i + 1);
            if (i === 1 || i === 3) {
                q.sourceQuote = "this quote is not in the lecture text at all";
            }
            questions.push(q);
        }
        geminiResponses = [{ questions }];

        const result = await generateQuizDraft(SAMPLE_TEXT, buildParams(10));
        expect(result.questions).toHaveLength(10);
        expect(callCount).toBe(1);
        expect(result.questions.filter((q) => q.sourceQuote === "").length).toBeGreaterThanOrEqual(2);
    });
});
