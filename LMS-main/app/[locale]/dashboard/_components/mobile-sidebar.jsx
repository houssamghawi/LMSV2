"use client";

import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "./sidebar";
import { useLocale } from "next-intl";

export const MobileSidebar = () => {
  const locale = useLocale();
  const sheetSide = locale === "ar" ? "right" : "left";
  return (
    <Sheet>
      <SheetTrigger className="lg:hidden pe-4 hover:opacity-75 transition">
        <Menu />
      </SheetTrigger>
      <SheetContent side={sheetSide} className="p-0 bg-white">
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
};
