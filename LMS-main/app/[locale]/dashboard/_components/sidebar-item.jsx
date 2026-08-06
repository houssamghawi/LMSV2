"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export const SidebarItem = ({ icon: Icon, label, href }) => {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-x-2 text-slate-500 text-sm font-[500] ps-6 transition-all hover:text-slate-600 hover:bg-slate-300/20",
        isActive &&
          "text-emerald-600 bg-emerald-200/20 hover:bg-emerald-200/20 hover:text-emerald-600"
      )}
    >
      <div className="flex items-center gap-x-2 py-4">
        <Icon
          size={22}
          className={cn("text-slate-500", isActive && "text-emerald-600")}
        />
        {label}
      </div>
      <div
        className={cn(
          "ms-auto opacity-0 border-2 border-emerald-600 h-full transition-all",
          isActive && "opacity-100"
        )}
      />
    </Link>
  );
};
