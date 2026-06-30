import { adminGetUsers } from "@/app/actions/admin";
import { getAdminUser } from "@/lib/admin-utils";
import UsersTable from "./_components/users-table";
import { getTranslations } from "next-intl/server";

export const metadata = {
    title: "Users Management - Admin",
    description: "Manage all users in the platform"
};

export default async function UsersPage(props) {
    await getAdminUser();
    const t = await getTranslations("Admin");

    // Await searchParams in Next.js 15
    const searchParams = await props.searchParams;

    const params = {
        page: searchParams?.page ? parseInt(searchParams.page) : 1,
        limit: searchParams?.limit ? parseInt(searchParams.limit) : 20,
        search: searchParams?.search || '',
        role: searchParams?.role || '',
        status: searchParams?.status || '',
        sortBy: searchParams?.sortBy || 'createdAt',
        sortOrder: searchParams?.sortOrder || 'desc'
    };

    let data;
    try {
        data = await adminGetUsers(params);
    } catch (error) {
        console.error('Error fetching users:', error);
        // Return empty data structure to prevent crashes
        data = {
            users: [],
            pagination: {
                page: params.page,
                limit: params.limit,
                total: 0,
                totalPages: 0
            }
        };
    }
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{t("usersManagement")}</h1>
                <p className="text-gray-600 mt-2">{t("manageUsersSub")}</p>
            </div>

            <UsersTable initialData={data} />
        </div>
    );
}

