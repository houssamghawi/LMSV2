// Integration test: GET /api/tutor/history — student course history (Phase 5).
import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock.js";
import { setLoggedInUser } from "../helpers/auth-mock.js";
import {
    seedUser,
    seedCourse,
    seedLesson,
    seedModule,
    seedEnrollment,
    seedTutorInteraction,
    buildGetRequest
} from "../helpers/fixtures.js";
import { getStudentTutorInteractions } from "@/queries/tutor-interactions";

const { GET: historyGet } = await import("@/app/api/tutor/history/route.js");

let instructor;
let student;
let course;
let lessonA;
let lessonB;

beforeEach(async () => {
    instructor = await seedUser({ role: "instructor", email: "inst@example.com" });
    student = await seedUser({ role: "student", email: "student@example.com" });
    course = await seedCourse(instructor._id, { title: "Biology 101" });
    lessonA = await seedLesson({ title: "Cell Biology", slug: "cell-bio" });
    lessonB = await seedLesson({ title: "Genetics", slug: "genetics" });
    await seedModule(course._id, [lessonA._id, lessonB._id]);
    await seedEnrollment(course._id, student._id);

    await seedTutorInteraction({
        studentId: student._id,
        courseId: course._id,
        lessonId: lessonA._id,
        overrides: { question: "Lesson A question" }
    });
    await seedTutorInteraction({
        studentId: student._id,
        courseId: course._id,
        lessonId: lessonB._id,
        overrides: { question: "Lesson B question" }
    });

    setLoggedInUser({
        id: student._id.toString(),
        role: "student",
        email: student.email
    });
});

describe("Student history access (Phase 5)", () => {
    it("getStudentTutorInteractions returns course-scoped history across lessons", async () => {
        const result = await getStudentTutorInteractions({
            studentId: student._id.toString(),
            courseId: course._id.toString()
        });

        expect(result.interactions).toHaveLength(2);
        expect(result.pagination.total).toBe(2);
    });

    it("GET /api/tutor/history returns all own interactions for the course", async () => {
        const req = buildGetRequest("http://localhost/api/tutor/history", {
            courseId: course._id.toString()
        });

        const res = await historyGet(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.interactions).toHaveLength(2);

        const questions = json.data.interactions.map((row) => row.question);
        expect(questions).toContain("Lesson A question");
        expect(questions).toContain("Lesson B question");
    });

    it("GET /api/tutor/history can filter to a single lesson", async () => {
        const req = buildGetRequest("http://localhost/api/tutor/history", {
            courseId: course._id.toString(),
            lessonId: lessonA._id.toString()
        });

        const res = await historyGet(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.interactions).toHaveLength(1);
        expect(json.data.interactions[0].question).toBe("Lesson A question");
    });
});
