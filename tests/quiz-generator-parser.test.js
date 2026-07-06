import { describe, it, expect } from "vitest";

import {
    coerceRawQuestion,
    normalizeDraftQuestion,
    countWords,
    quoteIsGrounded,
    filterUngroundedQuestions
} from "@/service/quiz-generator";

describe("quiz-generator: response coercion", () => {
    it("coerces application schema (draftId, text, correctOptionIds)", () => {
        const q = coerceRawQuestion({
            draftId: "abc-123",
            type: "single",
            difficulty: "easy",
            text: "What is photosynthesis?",
            options: [
                { id: "a", text: "A process" },
                { id: "b", text: "A mineral" }
            ],
            correctOptionIds: ["a"],
            explanation: "Because A.",
            sourceQuote: "Photosynthesis is a process."
        });
        expect(q.type).toBe("single");
        expect(q.text).toBe("What is photosynthesis?");
        expect(q.correctOptionIds).toEqual(["a"]);
    });

    it("coerces legacy Gemini schema (id, question_text, correct_answer)", () => {
        const q = coerceRawQuestion({
            id: "q1",
            type: "single",
            difficulty: "medium",
            question_text: "Which is correct?",
            options: [
                { id: "a", text: "First" },
                { id: "b", text: "Second" }
            ],
            correct_answer: "b",
            explanation: "B is correct."
        });
        expect(q.draftId).toBe("q1");
        expect(q.text).toBe("Which is correct?");
        expect(q.correctOptionIds).toEqual(["b"]);
    });

    it("rejects essay and short_answer types", () => {
        expect(coerceRawQuestion({
            type: "essay",
            difficulty: "hard",
            text: "Explain the water cycle.",
            correct_answer: "Evaporation.",
            explanation: "Full cycle."
        })).toBeNull();

        expect(coerceRawQuestion({
            type: "short_answer",
            difficulty: "hard",
            text: "Explain the water cycle.",
            correct_answer: "Evaporation.",
            explanation: "Full cycle."
        })).toBeNull();

        expect(coerceRawQuestion({
            question_type: "essay",
            type: "single",
            difficulty: "easy",
            text: "Q?",
            options: [{ id: "a", text: "A" }],
            correct_answer: "a",
            explanation: "x"
        })).toBeNull();
    });

    it("maps mcq and multiple_choice aliases to single", () => {
        expect(coerceRawQuestion({
            type: "mcq",
            difficulty: "easy",
            text: "Q?",
            options: [{ id: "a", text: "A" }],
            correct_answer: "a",
            explanation: "x"
        })?.type).toBe("single");

        expect(coerceRawQuestion({
            type: "multiple_choice",
            difficulty: "easy",
            text: "Q?",
            options: [{ id: "a", text: "A" }],
            correct_answer: "a",
            explanation: "x"
        })?.type).toBe("single");
    });

    it("normalizes true_false with boolean correct_answer", () => {
        const q = coerceRawQuestion({
            type: "true_false",
            difficulty: "easy",
            text: "The sky is blue.",
            options: [],
            correct_answer: "true",
            explanation: "Yes."
        });
        expect(q.type).toBe("true_false");
        expect(q.options).toHaveLength(2);
        expect(q.correctOptionIds).toEqual(["t"]);
    });

    it("normalizeDraftQuestion produces DB-ready shape for MCQ", () => {
        const normalized = normalizeDraftQuestion({
            type: "single",
            difficulty: "medium",
            question_text: "Which is correct?",
            options: [
                { id: "a", text: "A" },
                { id: "b", text: "B" }
            ],
            correctOptionIds: ["a"],
            explanation: "Because.",
            source_quote: "A is correct in the text."
        });
        expect(normalized.type).toBe("single");
        expect(normalized.modelAnswer).toBe("");
        expect(normalized.sourceQuote).toBe("A is correct in the text.");
        expect(normalized.draftId).toBeTruthy();
    });

    it("coerces prompt-native schema (draftId, text, correctOptionIds)", () => {
        const q = coerceRawQuestion({
            draftId: "uuid-1",
            type: "single",
            difficulty: "easy",
            text: "What is 2+2?",
            options: [
                { id: "a", text: "3" },
                { id: "b", text: "4" }
            ],
            correctOptionIds: ["b"],
            modelAnswer: "",
            explanation: "Four.",
            sourceQuote: "Two plus two equals four."
        });
        expect(q.correctOptionIds).toEqual(["b"]);
        expect(q.sourceQuote).toBe("Two plus two equals four.");
    });

    it("returns null for unknown types", () => {
        expect(coerceRawQuestion({ type: "fill_blank", difficulty: "easy", text: "?" })).toBeNull();
    });
});

describe("quiz-generator: grounding helpers", () => {
    it("countWords counts whitespace-separated tokens", () => {
        expect(countWords("one two three")).toBe(3);
        expect(countWords("")).toBe(0);
    });

    it("quoteIsGrounded checks substring presence case-insensitively", () => {
        const source = "Photosynthesis converts light energy into chemical energy.";
        expect(quoteIsGrounded(source, "converts light energy")).toBe(true);
        expect(quoteIsGrounded(source, "not in text")).toBe(false);
    });

    it("quoteIsGrounded normalizes whitespace in source and quote", () => {
        const source = "Photosynthesis  converts\nlight energy into chemical energy.";
        expect(quoteIsGrounded(source, "converts light energy")).toBe(true);
    });

    it("filterUngroundedQuestions strips invalid quotes instead of dropping questions", () => {
        const source = "Photosynthesis converts light energy into chemical energy.";
        const questions = [
            {
                draftId: "1",
                type: "single",
                difficulty: "easy",
                text: "Valid quote?",
                options: [{ id: "a", text: "A" }],
                correctOptionIds: ["a"],
                explanation: "x",
                sourceQuote: "converts light energy"
            },
            {
                draftId: "2",
                type: "true_false",
                difficulty: "easy",
                text: "Bad quote?",
                options: [{ id: "t", text: "True" }, { id: "f", text: "False" }],
                correctOptionIds: ["t"],
                explanation: "x",
                sourceQuote: "fabricated text not in source"
            }
        ];
        const result = filterUngroundedQuestions(questions, source);
        expect(result).toHaveLength(2);
        expect(result[0].sourceQuote).toBe("converts light energy");
        expect(result[1].sourceQuote).toBe("");
    });
});
