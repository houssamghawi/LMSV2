import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/loggedin-user";
import { isAdminOrInstructor } from "@/lib/authorization";
import { quizConsentSchema } from "@/lib/validations";
import { AI_CONSENT_VERSION } from "@/lib/constants";
import { getUserConsent, acknowledgeConsent } from "@/queries/quiz-generation";

export const dynamic = "force-dynamic";

/**
 * POST /api/quiz-generation/consent (contracts §1).
 *
 * Body: { consentVersion?: string, action: "check" | "acknowledge" }
 *
 * Auth: instructor or admin only.
 */
export async function POST(request) {
    try {
        const user = await getLoggedInUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        if (!isAdminOrInstructor(user)) {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = quizConsentSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.issues?.[0]?.message || "Invalid body" },
                { status: 400 }
            );
        }

        const consentVersion = parsed.data.consentVersion || AI_CONSENT_VERSION;

        if (parsed.data.action === "check") {
            const { hasConsented, acknowledgedAt } = await getUserConsent(user.id, consentVersion);
            return NextResponse.json({
                ok: true,
                hasConsented,
                consentVersion,
                acknowledgedAt
            });
        }

        // acknowledge
        const userAgent = request.headers.get("user-agent") || null;
        await acknowledgeConsent(user.id, consentVersion, userAgent);
        return NextResponse.json({ ok: true, acknowledged: true, consentVersion });
    } catch (error) {
        console.error("[QUIZ_CONSENT_POST] Error:", error);
        return NextResponse.json(
            { ok: false, error: error?.message || "Failed to process consent" },
            { status: 500 }
        );
    }
}
