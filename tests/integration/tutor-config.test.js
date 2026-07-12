// Integration test: GET/PUT /api/tutor/config (T040).
import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/auth-mock.js";
import { setLoggedInUser } from "../helpers/auth-mock.js";
import {
    seedUser,
    buildJsonRequest,
    buildGetRequest
} from "../helpers/fixtures.js";

const { GET: configGet, PUT: configPut } = await import("@/app/api/tutor/config/route.js");

let admin;

beforeEach(async () => {
    admin = await seedUser({ role: "admin", email: "admin@example.com" });
    setLoggedInUser({
        id: admin._id.toString(),
        role: "admin",
        email: admin.email
    });
});

describe("GET/PUT /api/tutor/config (T040)", () => {
    it("GET returns global tutor configuration for admin", async () => {
        const req = buildGetRequest("http://localhost/api/tutor/config");
        const res = await configGet(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.outOfContextMessage.en).toBeTruthy();
        expect(json.data.outOfContextMessage.ar).toBeTruthy();
        expect(typeof json.data.enabled).toBe("boolean");
        expect(json.data.rateLimitPerHour).toBeGreaterThan(0);
    });

    it("PUT updates out-of-context message and GET reflects the change", async () => {
        const updatedEn =
            "Sorry, I could not find an answer in the course materials for your question.";
        const updatedAr =
            "عذرًا، لم أتمكن من العثور على إجابة في مواد الدورة لسؤالك.";

        const putReq = buildJsonRequest("http://localhost/api/tutor/config", {
            courseId: null,
            outOfContextMessage: {
                en: updatedEn,
                ar: updatedAr
            },
            rateLimitPerHour: 25
        }, "PUT");

        const putRes = await configPut(putReq);
        const putJson = await putRes.json();

        expect(putRes.status).toBe(200);
        expect(putJson.success).toBe(true);
        expect(putJson.data.outOfContextMessage.en).toBe(updatedEn);
        expect(putJson.data.rateLimitPerHour).toBe(25);
        expect(putJson.data.updatedBy?.id).toBe(admin._id.toString());

        const getReq = buildGetRequest("http://localhost/api/tutor/config");
        const getRes = await configGet(getReq);
        const getJson = await getRes.json();

        expect(getRes.status).toBe(200);
        expect(getJson.data.outOfContextMessage.en).toBe(updatedEn);
        expect(getJson.data.rateLimitPerHour).toBe(25);
    });

    it("401 when unauthenticated", async () => {
        setLoggedInUser(null);
        const req = buildGetRequest("http://localhost/api/tutor/config");
        const res = await configGet(req);
        expect(res.status).toBe(401);
    });
});
