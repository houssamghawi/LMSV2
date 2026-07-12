// Integration test: /api/tutor/config authorization (T041).
import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock.js";
import { setLoggedInUser } from "../helpers/auth-mock.js";
import {
    seedUser,
    buildJsonRequest,
    buildGetRequest
} from "../helpers/fixtures.js";

const { GET: configGet, PUT: configPut } = await import("@/app/api/tutor/config/route.js");

let instructor;
let student;

beforeEach(async () => {
    instructor = await seedUser({ role: "instructor", email: "inst@example.com" });
    student = await seedUser({ role: "student", email: "student@example.com" });
});

describe("GET/PUT /api/tutor/config — authorization (T041)", () => {
    it("403 for instructor on GET", async () => {
        setLoggedInUser({
            id: instructor._id.toString(),
            role: "instructor",
            email: instructor.email
        });

        const res = await configGet(buildGetRequest("http://localhost/api/tutor/config"));
        expect(res.status).toBe(403);
        expect((await res.json()).code).toBe("FORBIDDEN");
    });

    it("403 for student on GET", async () => {
        setLoggedInUser({
            id: student._id.toString(),
            role: "student",
            email: student.email
        });

        const res = await configGet(buildGetRequest("http://localhost/api/tutor/config"));
        expect(res.status).toBe(403);
    });

    it("403 for instructor on PUT", async () => {
        setLoggedInUser({
            id: instructor._id.toString(),
            role: "instructor",
            email: instructor.email
        });

        const res = await configPut(
            buildJsonRequest(
                "http://localhost/api/tutor/config",
                { enabled: false },
                "PUT"
            )
        );
        expect(res.status).toBe(403);
    });

    it("403 for student on PUT", async () => {
        setLoggedInUser({
            id: student._id.toString(),
            role: "student",
            email: student.email
        });

        const res = await configPut(
            buildJsonRequest(
                "http://localhost/api/tutor/config",
                { enabled: false },
                "PUT"
            )
        );
        expect(res.status).toBe(403);
    });
});
