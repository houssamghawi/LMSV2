/** @typedef {{ role: "student" | "tutor", content: string }} TutorConversationTurn */

export const TUTOR_CONVERSATION_TURN_LIMIT = 8;

/**
 * Merge DB-backed turns with the live session and cap length.
 *
 * @param {TutorConversationTurn[]} dbTurns
 * @param {TutorConversationTurn[]} clientTurns
 * @returns {TutorConversationTurn[]}
 */
export function mergeConversationTurns(dbTurns = [], clientTurns = []) {
    const client = Array.isArray(clientTurns) ? clientTurns : [];
    const db = Array.isArray(dbTurns) ? dbTurns : [];

    if (client.length >= 2) {
        return client.slice(-TUTOR_CONVERSATION_TURN_LIMIT);
    }

    return [...db, ...client].slice(-TUTOR_CONVERSATION_TURN_LIMIT);
}

/**
 * Format recent turns for the tutor system prompt.
 *
 * @param {TutorConversationTurn[]} turns
 * @returns {string}
 */
export function formatConversationBlock(turns = []) {
    if (!turns.length) {
        return "(no prior messages in this conversation)";
    }

    return turns
        .map((turn) => {
            const label = turn.role === "student" ? "Student" : "Tutor";
            return `${label}: ${String(turn.content || "").trim()}`;
        })
        .join("\n");
}

/**
 * Build an embedding query using recent conversation plus the latest message.
 *
 * @param {string} question
 * @param {TutorConversationTurn[]} turns
 */
export function buildRetrievalQuery(question, turns = []) {
    const trimmed = String(question || "").trim();
    if (!turns.length) {
        return trimmed;
    }

    const recent = turns.slice(-4);
    const lines = recent.map((turn) => {
        const label = turn.role === "student" ? "Student" : "Tutor";
        return `${label}: ${String(turn.content || "").trim()}`;
    });

    return [...lines, `Student: ${trimmed}`].join("\n");
}

/**
 * @param {Array<{ question?: string, response?: string }>} interactions
 * @returns {TutorConversationTurn[]}
 */
export function interactionsToTurns(interactions = []) {
    const turns = [];

    for (const interaction of interactions) {
        if (interaction?.question) {
            turns.push({ role: "student", content: interaction.question });
        }
        if (interaction?.response) {
            turns.push({ role: "tutor", content: interaction.response });
        }
    }

    return turns;
}

/**
 * Last interaction that retrieved lecture chunks successfully.
 *
 * @param {Array<{ contextChunkIds?: string[] }>} interactions
 */
export function findLastInteractionWithChunks(interactions = []) {
    for (let index = interactions.length - 1; index >= 0; index -= 1) {
        const interaction = interactions[index];
        if (interaction?.contextChunkIds?.length) {
            return interaction;
        }
    }

    return null;
}
