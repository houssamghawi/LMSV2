import { describe, it, expect } from "vitest";

import {
    coerceRawQuestion,
    normalizeDraftQuestion,
    countWords,
    quoteIsGrounded
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

    it("maps essay type to short_answer", () => {
        const q = coerceRawQuestion({
            type: "essay",
            difficulty: "hard",
            text: "Explain the water cycle.",
            options: [],
            correct_answer: "Evaporation, condensation, precipitation.",
            explanation: "Full cycle description.",
            sourceQuote: "Water evaporates from surfaces."
        });
        expect(q.type).toBe("short_answer");
        expect(q.modelAnswer).toBe("Evaporation, condensation, precipitation.");
        expect(q.correctOptionIds).toEqual([]);
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

    it("normalizeDraftQuestion produces DB-ready shape", () => {
        const normalized = normalizeDraftQuestion({
            type: "short_answer",
            difficulty: "medium",
            question_text: "Describe X.",
            correct_answer: "X is Y.",
            explanation: "Because.",
            source_quote: "X is Y in the text."
        });
        expect(normalized.type).toBe("short_answer");
        expect(normalized.modelAnswer).toBe("X is Y.");
        expect(normalized.sourceQuote).toBe("X is Y in the text.");
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
});
