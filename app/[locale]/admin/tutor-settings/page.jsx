import { getTranslations } from "next-intl/server";
import { getAdminTutorConfig } from "@/queries/tutor-interactions";
import { TutorConfigForm } from "./_components/tutor-config-form";

export const dynamic = "force-dynamic";

export default async function AdminTutorSettingsPage() {
    const t = await getTranslations("Tutor");
    const config = await getAdminTutorConfig(null);

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold" dir="auto">
                    {t("settingsTitle")}
                </h1>
                <p className="text-slate-600" dir="auto">
                    {t("settingsSubtitle")}
                </p>
                {config.updatedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                        {t("settingsLastUpdated", {
                            date: new Date(config.updatedAt).toLocaleString(),
                            name: config.updatedBy?.name ?? "—"
                        })}
                    </p>
                )}
            </div>
            <div className="rounded-lg border bg-white p-6">
                <TutorConfigForm initialConfig={config} />
            </div>
        </div>
    );
}
