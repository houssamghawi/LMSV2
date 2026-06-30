"use client";

import { useTranslations } from "next-intl";

export function LessonVideoLoading() {
  const t = useTranslations("Lesson");
  return (
    <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center animate-pulse">
      <span className="text-muted-foreground">{t("loadingVideo")}</span>
    </div>
  );
}
