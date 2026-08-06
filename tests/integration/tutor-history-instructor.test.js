// Integration test: GET /api/tutor/history — instructor view (T029).
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
let studentA;
let studentB;
let otherInstructor;
let course;
let otherCourse;
let lesson;

beforeEach(async () => {
    instructor = await seedUser({ role: "instructor", email: "inst@example.com" });
    otherInstructor = await seedUser({
        role: "instructor",
        email: "other-inst@example.com"
    });
    studentA = await seedUser({
        role: "student",
        email: "student-a@example.com",
        firstName: "Alice",
        lastName: "Student"
    });
    studentB = await seedUser({
        role: "student",
        email: "student-b@example.com",
        firstName: "Bob",
        lastName: "Learner"
    });

    course = await seedCourse(instructor._id, { title: "Biology 101" });
    otherCourse = await seedCourse(otherInstructor._id, { title: "Chemistry 101" });
    lesson = await seedLesson({ title: "Cell Biology" });
    await seedModule(course._id, [lesson._id]);
    await seedEnrollment(course._id, studentA._id);
    await seedEnrollment(course._id, studentB._id);

    await seedTutorInteraction({
        studentId: studentA._id,
        courseId: course._id,
        lessonId: lesson._id,
        overrides: {
            question: "Where does photosynthesis occur?",
            contextStatus: "answered"
        }
    });
    await seedTutorInteraction({
        studentId: studentB._id,
        courseId: course._id,
        lessonId: lesson._id,
        overrides: {
            question: "What is quantum physics?",
            response: "I cannot find the answer in the lecture materials.",
            citation: null,
            contextStatus: "out_of_context"
        }
    });

    setLoggedInUser({
        id: instructor._id.toString(),
        role: "instructor",
        email: instructor.email
    });
});

describe("GET /api/tutor/history — instructor view (T029)", () => {
    it("returns all student interactions for the instructor's course", async () => {
        const req = buildGetRequest("http://localhost/api/tutor/history", {
            courseId: course._id.toString()
        });

        const res = await historyGet(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.interactions).toHaveLength(2);
        expect(json.data.pagination.total).toBe(2);

        const studentNames = json.data.interactions.map((row) => row.studentName);
        expect(studentNames).toContain("Alice Student");
        expect(studentNames).toContain("Bob Learner");
    });

    it("filters by out_of_context responses", async () => {
        const req = buildGetRequest("http://localhost/api/tutor/history", {
            courseId: course._id.toString(),
            contextStatus: "out_of_context"
        });

        const res = await historyGet(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.data.interactions).toHaveLength(1);
        expect(json.data.interactions[0].contextStatus).toBe("out_of_context");
        expect(json.data.interactions[0].question).toContain("quantum");
    });

    it("401 when unauthenticated", async () => {
        setLoggedInUser(null);
        const req = buildGetRequest("http://localhost/api/tutor/history", {
            courseId: course._id.toString()
        });
        const res = await historyGet(req);
        expect(res.status).toBe(401);
    });
});
