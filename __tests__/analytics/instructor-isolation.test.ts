// Integration test: instructor analytics data isolation (T037 / FR-011).
import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/helpers/auth-mock.js";
import { setLoggedInUser } from "../../tests/helpers/auth-mock.js";
import {
  seedUser,
  seedCourse,
  seedEnrollment,
  buildGetRequest,
} from "../../tests/helpers/fixtures.js";
import { Payment } from "@/model/payment-model";

const { GET: instructorOverviewGet } = await import(
  "@/app/api/analytics/instructor/overview/route.ts"
);

let instructorA;
let instructorB;
let student;
let courseA;
let courseB;

beforeEach(async () => {
  instructorA = await seedUser({
    role: "instructor",
    email: "inst-a-isolation@example.com",
  });
  instructorB = await seedUser({
    role: "instructor",
    email: "inst-b-isolation@example.com",
  });
  student = await seedUser({
    role: "student",
    email: "student-isolation@example.com",
  });
  courseA = await seedCourse(instructorA._id, { title: "Course A" });
  courseB = await seedCourse(instructorB._id, { title: "Course B" });

  await seedEnrollment(courseA._id, student._id);
  await seedEnrollment(courseB._id, student._id);

  await Payment.create({
    user: student._id,
    course: courseA._id,
    amount: 100,
    currency: "USD",
    status: "succeeded",
    provider: "mockpay",
    referenceId: `ref-a-${Date.now()}`,
    paidAt: new Date(),
  });
  await Payment.create({
    user: student._id,
    course: courseB._id,
    amount: 250,
    currency: "USD",
    status: "succeeded",
    provider: "mockpay",
    referenceId: `ref-b-${Date.now()}`,
    paidAt: new Date(),
  });
});

describe("Instructor analytics isolation (FR-011)", () => {
  it("instructor A only sees their own courses and revenue", async () => {
    setLoggedInUser({
      id: instructorA._id.toString(),
      role: "instructor",
      email: instructorA.email,
    });

    const res = await instructorOverviewGet(
      buildGetRequest("http://localhost/api/analytics/instructor/overview")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalCourses).toBe(1);
    expect(body.data.courses).toHaveLength(1);
    expect(body.data.courses[0].courseId).toBe(courseA._id.toString());
    expect(body.data.courses[0].title).toBe("Course A");
    expect(body.data.totalRevenue).toBe(100);
    expect(
      body.data.courses.some((c) => c.courseId === courseB._id.toString())
    ).toBe(false);
  });

  it("instructor B cannot access instructor A course via courseId", async () => {
    setLoggedInUser({
      id: instructorB._id.toString(),
      role: "instructor",
      email: instructorB.email,
    });

    const res = await instructorOverviewGet(
      buildGetRequest(
        `http://localhost/api/analytics/instructor/overview?courseId=${courseA._id}`
      )
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  it("instructor B overview never includes course A metrics", async () => {
    setLoggedInUser({
      id: instructorB._id.toString(),
      role: "instructor",
      email: instructorB.email,
    });

    const res = await instructorOverviewGet(
      buildGetRequest("http://localhost/api/analytics/instructor/overview")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.totalCourses).toBe(1);
    expect(body.data.courses[0].courseId).toBe(courseB._id.toString());
    expect(body.data.totalRevenue).toBe(250);
    expect(
      body.data.courses.some((c) => c.courseId === courseA._id.toString())
    ).toBe(false);
  });
});
