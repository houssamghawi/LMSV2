"use client";

import { BarChart } from "lucide-react";
import { BookOpen } from "lucide-react";
import { ClipboardCheck } from "lucide-react";
import { SidebarItem } from "./sidebar-item";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

const ROUTES = [
  { icon: BarChart, labelKey: "analytics", href: "/dashboard/analytics" },
  { icon: BookOpen, labelKey: "courses", href: "/dashboard/courses" },
  { icon: BookOpen, labelKey: "addCourse", href: "/dashboard/courses/add" },
];

export const SidebarRoutes = ({ pendingGradingCount = 0, showGrading = false }) => {
  const t = useTranslations("Dashboard");
  const tGrading = useTranslations("Grading");
  return (
    <div className="flex flex-col w-full">
      {ROUTES.map((route) => (
        <SidebarItem
          key={route.href}
          icon={route.icon}
          label={t(route.labelKey)}
          href={route.href}
        />
      ))}
      {showGrading && (
        <SidebarItem
          icon={ClipboardCheck}
          label={tGrading("title")}
          href="/dashboard/grading"
          badge={pendingGradingCount > 0 ? pendingGradingCount : undefined}
        />
      )}
    </div>
  );
};
