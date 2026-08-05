import { describe, it, expect } from "vitest";
import {
    buildRetrievalQuery,
    formatConversationBlock,
    mergeConversationTurns,
    interactionsToTurns
} from "@/lib/tutor-conversation";

describe("tutor conversation helpers", () => {
    it("merges DB turns with live session turns", () => {
        const merged = mergeConversationTurns(
            [
                { role: "student", content: "Old question" },
                { role: "tutor", content: "Old answer" }
            ],
            [
                { role: "student", content: "Hello" },
                { role: "tutor", content: "Hi there" }
            ]
        );

        expect(merged).toHaveLength(2);
        expect(merged[0].content).toBe("Hello");
    });

    it("builds retrieval queries with recent conversation context", () => {
        const query = buildRetrievalQuery("Can you simplify that?", [
            { role: "student", content: "What is photosynthesis?" },
            { role: "tutor", content: "Photosynthesis occurs in chloroplasts." }
        ]);

        expect(query).toContain("What is photosynthesis?");
        expect(query).toContain("Can you simplify that?");
    });

    it("formats conversation blocks for the prompt", () => {
        const block = formatConversationBlock([
            { role: "student", content: "Hello" },
            { role: "tutor", content: "Welcome" }
        ]);

        expect(block).toContain("Student: Hello");
        expect(block).toContain("Tutor: Welcome");
    });

    it("converts stored interactions into turns", () => {
        const turns = interactionsToTurns([
            { question: "Q1", response: "A1" },
            { question: "Q2", response: "A2" }
        ]);

        expect(turns).toHaveLength(4);
        expect(turns[0]).toEqual({ role: "student", content: "Q1" });
    });
});
