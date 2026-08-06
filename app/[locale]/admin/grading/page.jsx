import { getLoggedInUser } from "@/lib/loggedin-user";
import { isAdmin } from "@/lib/authorization";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPendingGradingAttempts } from "@/queries/quizv2";
import { AdminGradingTable } from "./_components/admin-grading-table";

export const dynamic = "force-dynamic";

/**
 * Admin aggregate grading queue (FR-020). Lists pending-grading attempts
 * across ALL instructors, with optional filters by course/quiz/instructor
 * passed via searchParams. Auth is enforced by the admin layout.
 */
export default async function AdminGradingPage({ searchParams }) {
    const t = await getTranslations("Grading");
    const user = await getLoggedInUser();
    if (!user || !isAdmin(user)) {
        notFound();
    }

    const sp = await searchParams;
    const page = Math.max(1, Number(sp?.page) || 1);
    const limit = 20;
    const basePath = "/admin/grading";
    const filters = {
        userId: user.id,
        role: "admin",
        page,
        limit
    };
    if (sp?.courseId) filters.courseId = String(sp.courseId);
    if (sp?.quizId) filters.quizId = String(sp.quizId);
    if (sp?.instructorId) filters.instructorId = String(sp.instructorId);

    const { items, total } = await getPendingGradingAttempts(filters);

    return (
        <div className="p-6 space-y-4">
            <div>
                <h1 className="text-2xl font-bold" dir="auto">{t("title")}</h1>
                <p className="text-slate-600" dir="auto">{t("subtitle")}</p>
            </div>
            <AdminGradingTable
                items={JSON.parse(JSON.stringify(items))}
                total={total}
                page={page}
                limit={limit}
                basePath={basePath}
            />
        </div>
    );
}
