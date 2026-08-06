import { getAdminUser } from "@/lib/admin-utils";
import { getCategories } from "@/queries/categories";
import { unstable_cache } from "next/cache";
import CategoriesTable from "./_components/categories-table";

const getCachedCategories = unstable_cache(
    async () => await getCategories(),
    ['admin-categories'],
    { revalidate: 300 }
);

export const metadata = {
    title: "Categories Management - Admin",
    description: "Manage course categories"
};

export default async function CategoriesPage() {
    await getAdminUser();
    
    const categories = await getCachedCategories();
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Categories Management</h1>
                <p className="text-gray-600 mt-2">Manage course categories</p>
            </div>

            <CategoriesTable categories={categories || []} />
        </div>
    );
}

