"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
    {
        title: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard
    },
    {
        title: "Users",
        href: "/admin/users",
        icon: Users
    },
    {
        title: "Courses",
        href: "/admin/courses",
        icon: BookOpen
    },
    {
        title: "Categories",
        href: "/admin/categories",
        icon: FolderTree
    },
    {
        title: "Enrollments",
        href: "/admin/enrollments",
        icon: ShoppingCart
    },
    {
        title: "Payments",
        href: "/admin/payments",
        icon: CreditCard
    },
    {
        title: "Reviews",
        href: "/admin/reviews",
        icon: MessageSquare
    },
    {
        title: "Analytics",
        href: "/admin/analytics",
        icon: BarChart3
    },
    {
        title: "Audit Log",
        href: "/admin/audit-log",
        icon: FileText
    },
    {
        title: "Settings",
        href: "/admin/settings",
        icon: Settings
    }
];

export default function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <Shield className="h-6 w-6 text-primary" />
                    <h1 className="text-xl font-bold">Admin Panel</h1>
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
                            <span className="font-medium">{item.title}</span>
                        </Link>
                    );
                })}
            </nav>
            
            <div className="p-4 border-t border-gray-200">
                <Link
                    href="/"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                    <span className="font-medium">← Back to Site</span>
                </Link>
            </div>
        </aside>
    );
}

