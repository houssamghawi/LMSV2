import { getLoggedInUser } from "@/lib/loggedin-user";
import { getPendingGradingAttempts } from "@/queries/quizv2";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GradingQueueTable } from "./_components/grading-queue-table";

export const dynamic = "force-dynamic";

export default async function GradingQueuePage({ searchParams }) {
    const t = await getTranslations("Grading");
    const user = await getLoggedInUser();
    if (!user) redirect("/login");
    if (user.role !== "instructor" && user.role !== "admin") notFound();

    const sp = await searchParams;
    const page = Math.max(1, Number(sp?.page) || 1);
    const limit = 20;
    const basePath = "/dashboard/grading";

    const { items, total } = await getPendingGradingAttempts({
        userId: user.id,
        role: user.role,
        page,
        limit
    });

    return (
        <div className="p-6 space-y-4">
            <div>
                <h1 className="text-2xl font-bold" dir="auto">{t("title")}</h1>
                <p className="text-slate-600" dir="auto">{t("subtitle")}</p>
            </div>
            <GradingQueueTable
                items={JSON.parse(JSON.stringify(items))}
                total={total}
                page={page}
                limit={limit}
                basePath={basePath}
            />
        </div>
    );
}
