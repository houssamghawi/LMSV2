/**
 * Diagnose RAG tutor: Chroma chunks, config threshold, sample queries.
 * Usage: npx tsx --tsconfig jsconfig.json scripts/diagnose-tutor-rag.js
 */

import { config } from "dotenv";
import mongoose from "mongoose";
import { dbConnect } from "@/service/mongo";
import { Lesson } from "@/model/lesson.model";
import { Module } from "@/model/module.model";
import { TutorConfiguration } from "@/model/tutor-config-model";
import { TutorInteraction } from "@/model/tutor-interaction-model";
import { countLessonChunks, queryChunks, heartbeat } from "@/service/vector-store";
import { embedTexts, extractLessonContent } from "@/service/lecture-embedder";
import { TUTOR_RELEVANCE_THRESHOLD } from "@/lib/constants";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
    await dbConnect();

    const configs = await TutorConfiguration.find({}).lean();
    console.log("\n=== Tutor configurations ===");
    for (const c of configs) {
        console.log({
            id: c._id.toString(),
            courseId: c.courseId?.toString() ?? null,
            relevanceThreshold: c.relevanceThreshold,
            maxContextChunks: c.maxContextChunks,
            enabled: c.enabled
        });
    }
    console.log("Code default TUTOR_RELEVANCE_THRESHOLD:", TUTOR_RELEVANCE_THRESHOLD);

    try {
        await heartbeat();
        console.log("\nChromaDB: reachable");
    } catch (err) {
        console.error("\nChromaDB: NOT reachable —", err?.message);
        process.exit(1);
    }

    const lessons = await Lesson.find({
        $or: [
            { extractedText: { $exists: true, $nin: [null, ""] } },
            { description: { $exists: true, $nin: [null, ""] } }
        ]
    })
        .select(
            "title extractedText description docxFilename tutorEmbeddingStatus"
        )
        .lean();

    console.log(`\n=== Lessons with content (${lessons.length}) ===`);
    const threshold =
        configs[0]?.relevanceThreshold ?? TUTOR_RELEVANCE_THRESHOLD;

    for (const lesson of lessons) {
        const mod = await Module.findOne({ lessonIds: lesson._id })
            .select("course")
            .lean();
        const courseId = mod?.course?.toString();
        const lessonId = lesson._id.toString();
        if (!courseId) {
            console.log({ lessonId, title: lesson.title, error: "no course" });
            continue;
        }

        const chunks = await countLessonChunks(courseId, lessonId);
        const content = extractLessonContent(lesson);
        console.log({
            lessonId,
            title: lesson.title,
            courseId,
            chromaChunks: chunks,
            contentLen: content.length,
            status: lesson.tutorEmbeddingStatus,
            preview: content.slice(0, 100)
        });

        if (chunks > 0 && content.length > 0) {
            const question =
                content.split(/[.!?]/).find((s) => s.trim().length > 20)?.trim() ||
                "What is this lesson about?";
            const [emb] = await embedTexts([question]);
            const matches = await queryChunks({
                courseId,
                lessonId,
                queryEmbedding: emb,
                relevanceThreshold: threshold
            });
            const all = await queryChunks({
                courseId,
                lessonId,
                queryEmbedding: emb,
                relevanceThreshold: 0
            });
            console.log("  sample question:", question.slice(0, 80));
            console.log(
                "  matches at threshold",
                threshold,
                ":",
                matches.length,
                matches.map((m) => m.similarity.toFixed(3))
            );
            console.log(
                "  raw top similarity:",
                all[0]?.similarity?.toFixed(3) ?? "none"
            );
        }
    }

    console.log("\n=== Recent tutor interactions ===");
    const recent = await TutorInteraction.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    for (const r of recent) {
        console.log({
            question: r.question?.slice(0, 70),
            contextStatus: r.contextStatus,
            relevanceScores: r.metadata?.relevanceScores,
            lessonId: r.lessonId?.toString(),
            courseId: r.courseId?.toString(),
            createdAt: r.createdAt
        });
    }

    const probeQuestion = process.argv[2] || "اشرح لي طبقة المخرجات";
    const probeLessonId =
        process.argv[3] || "6a54cfe4c93bb8b53ca1974c";
    const probeCourseId =
        process.argv[4] || "6a54cfc9c93bb8b53ca19702";
    console.log(`\n=== Probe question: "${probeQuestion}" ===`);
    const [probeEmb] = await embedTexts([probeQuestion]);
    const probeMatches = await queryChunks({
        courseId: probeCourseId,
        lessonId: probeLessonId,
        queryEmbedding: probeEmb,
        relevanceThreshold: threshold
    });
    console.log({
        lessonId: probeLessonId,
        courseId: probeCourseId,
        threshold,
        matchCount: probeMatches.length,
        similarities: probeMatches.map((m) => m.similarity.toFixed(3))
    });
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => mongoose.disconnect().catch(() => {}));
