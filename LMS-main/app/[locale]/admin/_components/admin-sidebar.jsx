"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
    LayoutDashboard,
    Users,
    BookOpen,
    FolderTree,
    MessageSquare,
    ShoppingCart,
    BarChart3,
    Settings,
    FileText,
    Shield,
    CreditCard
} from "lucide-react";

const adminNavItems = [
    { titleKey: "dashboard", href: "/admin", icon: LayoutDashboard },
    { titleKey: "users", href: "/admin/users", icon: Users },
    { titleKey: "courses", href: "/admin/courses", icon: BookOpen },
    { titleKey: "categories", href: "/admin/categories", icon: FolderTree },
    { titleKey: "enrollments", href: "/admin/enrollments", icon: ShoppingCart },
    { titleKey: "payments", href: "/admin/payments", icon: CreditCard },
    { titleKey: "reviews", href: "/admin/reviews", icon: MessageSquare },
    { titleKey: "analytics", href: "/admin/analytics", icon: BarChart3 },
    { titleKey: "auditLog", href: "/admin/audit-log", icon: FileText },
    { titleKey: "settings", href: "/admin/settings", icon: Settings }
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const t = useTranslations("Admin");

    return (
        <aside className="w-64 bg-white border-e border-gray-200 flex flex-col">
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <Shield className="h-6 w-6 text-primary" />
                    <h1 className="text-xl font-bold">{t("adminPanel")}</h1>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {adminNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-gray-700 hover:bg-gray-100"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="font-medium">{t(item.titleKey)}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-200">
                <Link
                    href="/"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                    <span className="font-medium">{t("backToSite")}</span>
                </Link>
            </div>
        </aside>
    );
}

