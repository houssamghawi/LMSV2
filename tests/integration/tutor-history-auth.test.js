// Integration test: GET /api/tutor/history — authorization (T030).
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

const { GET: historyGet } = await import("@/app/api/tutor/history/route.js");

let instructor;
let otherInstructor;
let studentA;
let studentB;
let course;
let lesson;

beforeEach(async () => {
    instructor = await seedUser({ role: "instructor", email: "inst@example.com" });
    otherInstructor = await seedUser({
        role: "instructor",
        email: "other-inst@example.com"
    });
    studentA = await seedUser({ role: "student", email: "student-a@example.com" });
    studentB = await seedUser({ role: "student", email: "student-b@example.com" });

    course = await seedCourse(instructor._id, { title: "Biology 101" });
    lesson = await seedLesson({ title: "Cell Biology" });
    await seedModule(course._id, [lesson._id]);
    await seedEnrollment(course._id, studentA._id);
    await seedEnrollment(course._id, studentB._id);

    await seedTutorInteraction({
        studentId: studentA._id,
        courseId: course._id,
        lessonId: lesson._id,
        overrides: { question: "Student A question" }
    });
    await seedTutorInteraction({
        studentId: studentB._id,
        courseId: course._id,
        lessonId: lesson._id,
        overrides: { question: "Student B question" }
    });
});

describe("GET /api/tutor/history — authorization (T030)", () => {
    it("student sees only their own interactions", async () => {
        setLoggedInUser({
            id: studentA._id.toString(),
            role: "student",
            email: studentA.email
        });

        const req = buildGetRequest("http://localhost/api/tutor/history", {
            courseId: course._id.toString()
        });

        const res = await historyGet(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.interactions).toHaveLength(1);
        expect(json.data.interactions[0].question).toBe("Student A question");
        expect(json.data.interactions[0].studentName).toBeUndefined();
    });

    it("403 when instructor does not own the course", async () => {
        setLoggedInUser({
            id: otherInstructor._id.toString(),
            role: "instructor",
            email: otherInstructor.email
        });

        const req = buildGetRequest("http://localhost/api/tutor/history", {
            courseId: course._id.toString()
        });

        const res = await historyGet(req);
        const json = await res.json();

        expect(res.status).toBe(403);
        expect(json.code).toBe("FORBIDDEN");
    });

    it("403 when student is not enrolled", async () => {
        const outsider = await seedUser({ role: "student", email: "outsider@example.com" });
        setLoggedInUser({
            id: outsider._id.toString(),
            role: "student",
            email: outsider.email
        });

        const req = buildGetRequest("http://localhost/api/tutor/history", {
            courseId: course._id.toString()
        });

        const res = await historyGet(req);
        expect(res.status).toBe(403);
        expect((await res.json()).code).toBe("NOT_ENROLLED");
    });

    it("admin can view all interactions for any course", async () => {
        const admin = await seedUser({ role: "admin", email: "admin@example.com" });
        setLoggedInUser({
            id: admin._id.toString(),
            role: "admin",
            email: admin.email
        });

        const req = buildGetRequest("http://localhost/api/tutor/history", {
            courseId: course._id.toString()
        });

        const res = await historyGet(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.interactions).toHaveLength(2);
        expect(json.data.interactions[0].studentName).toBeTruthy();
    });
});
