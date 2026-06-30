import { getAdminUser } from "@/lib/admin-utils";
import { getCategories } from "@/queries/categories";
import CategoriesTable from "./_components/categories-table";
import { getTranslations } from "next-intl/server";

export const metadata = {
    title: "Categories Management - Admin",
    description: "Manage course categories"
};

// Ensure fresh data from database on every request
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CategoriesPage() {
    await getAdminUser();
    const t = await getTranslations("Admin");
    
    // Fetch fresh categories data directly from database
    const categories = await getCategories();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{t("categoriesManagement")}</h1>
                <p className="text-gray-600 mt-2">{t("manageCategoriesSub")}</p>
            </div>

            <CategoriesTable categories={categories || []} />
        </div>
    );
}

