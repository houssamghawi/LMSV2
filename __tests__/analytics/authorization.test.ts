// Integration test: analytics authorization matrix (T017 / Constitution II).
import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/helpers/auth-mock.js";
import { setLoggedInUser } from "../../tests/helpers/auth-mock.js";
import { seedUser, seedCourse, buildGetRequest } from "../../tests/helpers/fixtures.js";

const { GET: adminOverviewGet } = await import(
  "@/app/api/analytics/admin/overview/route.ts"
);
const { GET: instructorOverviewGet } = await import(
  "@/app/api/analytics/instructor/overview/route.ts"
);

let admin;
let instructor;
let otherInstructor;
let student;
let ownedCourse;
let otherCourse;

beforeEach(async () => {
  admin = await seedUser({ role: "admin", email: "admin-analytics@example.com" });
  instructor = await seedUser({
    role: "instructor",
    email: "inst-analytics@example.com",
  });
  otherInstructor = await seedUser({
    role: "instructor",
    email: "other-inst-analytics@example.com",
  });
  student = await seedUser({
    role: "student",
    email: "student-analytics@example.com",
  });
  ownedCourse = await seedCourse(instructor._id);
  otherCourse = await seedCourse(otherInstructor._id);
});

describe("GET /api/analytics/admin/overview — authorization", () => {
  it("401 when unauthenticated", async () => {
    setLoggedInUser(null);
    const res = await adminOverviewGet(
      buildGetRequest("http://localhost/api/analytics/admin/overview")
    );
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("AUTH_REQUIRED");
  });

  it("403 for student", async () => {
    setLoggedInUser({
      id: student._id.toString(),
      role: "student",
      email: student.email,
    });
    const res = await adminOverviewGet(
      buildGetRequest("http://localhost/api/analytics/admin/overview")
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  it("403 for instructor", async () => {
    setLoggedInUser({
      id: instructor._id.toString(),
      role: "instructor",
      email: instructor.email,
    });
    const res = await adminOverviewGet(
      buildGetRequest("http://localhost/api/analytics/admin/overview")
    );
    expect(res.status).toBe(403);
  });

  it("200 for admin", async () => {
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
    expect(body.data).toBeDefined();
  });
});

describe("GET /api/analytics/instructor/overview — authorization", () => {
  it("401 when unauthenticated", async () => {
    setLoggedInUser(null);
    const res = await instructorOverviewGet(
      buildGetRequest("http://localhost/api/analytics/instructor/overview")
    );
    expect(res.status).toBe(401);
  });

  it("403 for student", async () => {
    setLoggedInUser({
      id: student._id.toString(),
      role: "student",
      email: student.email,
    });
    const res = await instructorOverviewGet(
      buildGetRequest("http://localhost/api/analytics/instructor/overview")
    );
    expect(res.status).toBe(403);
  });

  it("200 for instructor (own scope)", async () => {
    setLoggedInUser({
      id: instructor._id.toString(),
      role: "instructor",
      email: instructor.email,
    });
    const res = await instructorOverviewGet(
      buildGetRequest("http://localhost/api/analytics/instructor/overview")
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("200 for instructor with owned courseId", async () => {
    setLoggedInUser({
      id: instructor._id.toString(),
      role: "instructor",
      email: instructor.email,
    });
    const res = await instructorOverviewGet(
      buildGetRequest(
        `http://localhost/api/analytics/instructor/overview?courseId=${ownedCourse._id}`
      )
    );
    expect(res.status).toBe(200);
  });

  it("403 for instructor with another instructor's courseId", async () => {
    setLoggedInUser({
      id: instructor._id.toString(),
      role: "instructor",
      email: instructor.email,
    });
    const res = await instructorOverviewGet(
      buildGetRequest(
        `http://localhost/api/analytics/instructor/overview?courseId=${otherCourse._id}`
      )
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  it("200 for admin (allowed on instructor overview)", async () => {
    setLoggedInUser({
      id: admin._id.toString(),
      role: "admin",
      email: admin.email,
    });
    const res = await instructorOverviewGet(
      buildGetRequest("http://localhost/api/analytics/instructor/overview")
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /api/analytics/admin/users — authorization", () => {
  it("401 when unauthenticated", async () => {
    setLoggedInUser(null);
    const { GET: usersGet } = await import(
      "@/app/api/analytics/admin/users/route.ts"
    );
    const res = await usersGet(
      buildGetRequest("http://localhost/api/analytics/admin/users")
    );
    expect(res.status).toBe(401);
  });

  it("403 for student", async () => {
    setLoggedInUser({
      id: student._id.toString(),
      role: "student",
      email: student.email,
    });
    const { GET: usersGet } = await import(
      "@/app/api/analytics/admin/users/route.ts"
    );
    const res = await usersGet(
      buildGetRequest("http://localhost/api/analytics/admin/users")
    );
    expect(res.status).toBe(403);
  });

  it("200 for admin with user analytics payload", async () => {
    setLoggedInUser({
      id: admin._id.toString(),
      role: "admin",
      email: admin.email,
    });
    const { GET: usersGet } = await import(
      "@/app/api/analytics/admin/users/route.ts"
    );
    const res = await usersGet(
      buildGetRequest("http://localhost/api/analytics/admin/users")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.totals).toBeDefined();
    expect(body.data.registrationTrend).toBeDefined();
    expect(body.data.roleDistribution).toBeDefined();
    expect(body.data.activityByHour).toHaveLength(24);
  });
});

describe("GET /api/analytics/admin/revenue — authorization", () => {
  it("401 when unauthenticated", async () => {
    setLoggedInUser(null);
    const { GET: revenueGet } = await import(
      "@/app/api/analytics/admin/revenue/route.ts"
    );
    const res = await revenueGet(
      buildGetRequest("http://localhost/api/analytics/admin/revenue")
    );
    expect(res.status).toBe(401);
  });

  it("403 for instructor", async () => {
    setLoggedInUser({
      id: instructor._id.toString(),
      role: "instructor",
      email: instructor.email,
    });
    const { GET: revenueGet } = await import(
      "@/app/api/analytics/admin/revenue/route.ts"
    );
    const res = await revenueGet(
      buildGetRequest("http://localhost/api/analytics/admin/revenue")
    );
    expect(res.status).toBe(403);
  });

  it("200 for admin with revenue analytics payload", async () => {
    setLoggedInUser({
      id: admin._id.toString(),
      role: "admin",
      email: admin.email,
    });
    const { GET: revenueGet } = await import(
      "@/app/api/analytics/admin/revenue/route.ts"
    );
    const res = await revenueGet(
      buildGetRequest("http://localhost/api/analytics/admin/revenue")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.totals).toBeDefined();
    expect(body.data.revenueTrend).toBeDefined();
    expect(body.data.revenueByCourse).toBeDefined();
    expect(body.data.transactionStatusBreakdown).toBeDefined();
  });
});

describe("GET /api/analytics/admin/courses — authorization", () => {
  it("401 when unauthenticated", async () => {
    setLoggedInUser(null);
    const { GET: coursesGet } = await import(
      "@/app/api/analytics/admin/courses/route.ts"
    );
    const res = await coursesGet(
      buildGetRequest("http://localhost/api/analytics/admin/courses")
    );
    expect(res.status).toBe(401);
  });

  it("403 for student", async () => {
    setLoggedInUser({
      id: student._id.toString(),
      role: "student",
      email: student.email,
    });
    const { GET: coursesGet } = await import(
      "@/app/api/analytics/admin/courses/route.ts"
    );
    const res = await coursesGet(
      buildGetRequest("http://localhost/api/analytics/admin/courses")
    );
    expect(res.status).toBe(403);
  });

  it("200 for admin with course analytics payload", async () => {
    setLoggedInUser({
      id: admin._id.toString(),
      role: "admin",
      email: admin.email,
    });
    const { GET: coursesGet } = await import(
      "@/app/api/analytics/admin/courses/route.ts"
    );
    const res = await coursesGet(
      buildGetRequest("http://localhost/api/analytics/admin/courses")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.totals).toBeDefined();
    expect(body.data.enrollmentTrend).toBeDefined();
    expect(body.data.topCourses).toBeDefined();
    expect(body.data.categoryDistribution).toBeDefined();
  });
});
