"use client";

import { useLocale } from "next-intl";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export const CourseSidebarMobile = ({ children }) => {
  const locale = useLocale();
  const isRtl = locale === "ar";

  return (
    <Sheet>
      <SheetTrigger className="lg:hidden pe-4 hover:opacity-75 transition">
        <Menu />
      </SheetTrigger>
      <SheetContent side={isRtl ? "right" : "left"} className="p-0 bg-white w-72">
        {children}
      </SheetContent>
    </Sheet>
  );
};
