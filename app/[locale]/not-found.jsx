import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <EmptyState
      title={t("title")}
      description={t("description")}
      icon="notFound"
      actionUrl="/"
      actionLabel={t("goHome")}
      className="min-h-screen"
    />
  );
}
