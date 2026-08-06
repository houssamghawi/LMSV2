import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-helpers";
import AdminSidebar from "./_components/admin-sidebar";
import AdminNavbar from "./_components/admin-navbar";

export default async function AdminLayout({ children }) {
    // Use auth helper - will redirect if not authenticated or not admin
    const user = await requireAdmin(true);

    return (
        <div className="flex h-screen bg-gray-50">
            <AdminSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <AdminNavbar user={user} />
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}

