import { getTranslations } from "next-intl/server";
import { getAdminQuizConfig } from "@/queries/quiz-generation";
import { QuizConfigForm } from "./_components/quiz-config-form";

export const dynamic = "force-dynamic";

/**
 * Admin quiz generation settings page (FR-012).
 *
 * Loads the current AdminQuizConfig singleton and renders the editable form.
 * Auth is enforced by the admin layout (`requireAdmin`) — this page only
 * renders for admins.
 */
export default async function AdminQuizSettingsPage() {
    const t = await getTranslations("AdminQuizSettings");
    const config = await getAdminQuizConfig();

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold" dir="auto">{t("title")}</h1>
                <p className="text-slate-600" dir="auto">{t("subtitle")}</p>
            </div>
            <div className="rounded-lg border bg-white p-6">
                <QuizConfigForm initialConfig={config} />
            </div>
        </div>
    );
}
