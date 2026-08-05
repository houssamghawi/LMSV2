// Integration tests: analytics aggregations happy paths (T068).
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
import { subDays } from "date-fns";

const { GET: adminOverviewGet } = await import(
  "@/app/api/analytics/admin/overview/route.ts"
);
const { GET: adminRevenueGet } = await import(
  "@/app/api/analytics/admin/revenue/route.ts"
);
const { GET: instructorOverviewGet } = await import(
  "@/app/api/analytics/instructor/overview/route.ts"
);

let admin;
let instructorA;
let instructorB;
let student;
let courseA;
let courseB;

beforeEach(async () => {
  admin = await seedUser({
    role: "admin",
    email: `admin-agg-${Date.now()}@example.com`,
  });
  instructorA = await seedUser({
    role: "instructor",
    email: `inst-a-agg-${Date.now()}@example.com`,
  });
  instructorB = await seedUser({
    role: "instructor",
    email: `inst-b-agg-${Date.now()}@example.com`,
  });
  student = await seedUser({
    role: "student",
    email: `student-agg-${Date.now()}@example.com`,
  });
  courseA = await seedCourse(instructorA._id, { title: "Agg Course A" });
  courseB = await seedCourse(instructorB._id, { title: "Agg Course B" });

  await seedEnrollment(courseA._id, student._id);
  await seedEnrollment(courseB._id, student._id);

  const paidAt = subDays(new Date(), 3);
  await Payment.create({
    user: student._id,
    course: courseA._id,
    amount: 40,
    currency: "USD",
    status: "succeeded",
    provider: "mockpay",
    referenceId: `agg-a-${Date.now()}`,
    paidAt,
  });
  await Payment.create({
    user: student._id,
    course: courseB._id,
    amount: 60,
    currency: "USD",
    status: "succeeded",
    provider: "mockpay",
    referenceId: `agg-b-${Date.now()}`,
    paidAt,
  });
});

describe("Analytics aggregations (T068)", () => {
  it("admin overview returns platform totals and trends", async () => {
    setLoggedInUser({
      id: admin._id.toString(),
      role: "admin",
      email: admin.email,
    });

    const res = await adminOverviewGet(
      buildGetRequest("http://localhost/api/analytics/admin/overview")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalCourses).toBeGreaterThanOrEqual(2);
    expect(body.data.totalUsers).toBeGreaterThanOrEqual(4);
    expect(body.data.totalRevenue).toBeGreaterThanOrEqual(100);
    expect(body.data.trends).toBeDefined();
    expect(body.data.trends.revenue).toMatchObject({
      direction: expect.stringMatching(/up|down|stable/),
    });
  });

  it("admin revenue analytics includes period revenue from succeeded payments", async () => {
    setLoggedInUser({
      id: admin._id.toString(),
      role: "admin",
      email: admin.email,
    });

    const res = await adminRevenueGet(
      buildGetRequest("http://localhost/api/analytics/admin/revenue", {
        granularity: "day",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.totals.revenue).toBeGreaterThanOrEqual(100);
    expect(Array.isArray(body.data.revenueTrend)).toBe(true);
    expect(Array.isArray(body.data.revenueByCourse)).toBe(true);
  });

  it("instructor overview isolates revenue to owned courses only", async () => {
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
    expect(body.data.totalRevenue).toBe(40);
    expect(body.data.courses).toHaveLength(1);
    expect(body.data.courses[0].courseId).toBe(courseA._id.toString());
  });
});
