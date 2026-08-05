// Integration test: instructor student progress privacy + isolation (T045 / FR-008 / FR-011).
import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/helpers/auth-mock.js";
import { setLoggedInUser } from "../../tests/helpers/auth-mock.js";
import {
  seedUser,
  seedCourse,
  seedEnrollment,
  seedModule,
  seedLesson,
  buildGetRequest,
} from "../../tests/helpers/fixtures.js";

const { GET: studentsGet } = await import(
  "@/app/api/analytics/instructor/students/route.ts"
);

let instructorA;
let instructorB;
let student;
let courseA;
let courseB;

beforeEach(async () => {
  instructorA = await seedUser({
    role: "instructor",
    email: "inst-a-progress@example.com",
    firstName: "Alice",
    lastName: "Instructor",
  });
  instructorB = await seedUser({
    role: "instructor",
    email: "inst-b-progress@example.com",
  });
  student = await seedUser({
    role: "student",
    email: "secret-student@example.com",
    firstName: "Jane",
    lastName: "Doe",
    phone: "555-0100",
  });
  courseA = await seedCourse(instructorA._id, { title: "Progress Course A" });
  courseB = await seedCourse(instructorB._id, { title: "Progress Course B" });

  const lesson = await seedLesson({ title: "Lesson 1" });
  await seedModule(courseA._id, [lesson._id]);

  await seedEnrollment(courseA._id, student._id);
  await seedEnrollment(courseB._id, student._id);
});

describe("GET /api/analytics/instructor/students — privacy & isolation", () => {
  it("requires courseId", async () => {
    setLoggedInUser({
      id: instructorA._id.toString(),
      role: "instructor",
      email: instructorA.email,
    });
    const res = await studentsGet(
      buildGetRequest("http://localhost/api/analytics/instructor/students")
    );
    expect(res.status).toBe(400);
  });

  it("403 when instructor B requests instructor A course", async () => {
    setLoggedInUser({
      id: instructorB._id.toString(),
      role: "instructor",
      email: instructorB.email,
    });
    const res = await studentsGet(
      buildGetRequest(
        `http://localhost/api/analytics/instructor/students?courseId=${courseA._id}`
      )
    );
    expect(res.status).toBe(403);
  });

  it("returns privacy-limited fields only (no email/phone)", async () => {
    setLoggedInUser({
      id: instructorA._id.toString(),
      role: "instructor",
      email: instructorA.email,
    });
    const res = await studentsGet(
      buildGetRequest(
        `http://localhost/api/analytics/instructor/students?courseId=${courseA._id}`
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.courseId).toBe(courseA._id.toString());
    expect(body.data.students.length).toBeGreaterThanOrEqual(1);
    expect(body.data.aggregates).toBeDefined();

    const row = body.data.students[0];
    expect(row.name).toContain("Jane");
    expect(row.studentId).toBe(student._id.toString());
    expect(row.enrollmentDate).toBeDefined();
    expect(typeof row.progressPercent).toBe("number");
    expect(row.status).toBeDefined();

    // FR-008: must not leak contact PII
    expect(row.email).toBeUndefined();
    expect(row.phone).toBeUndefined();
    expect(JSON.stringify(row)).not.toContain("secret-student@example.com");
    expect(JSON.stringify(row)).not.toContain("555-0100");
  });
});
