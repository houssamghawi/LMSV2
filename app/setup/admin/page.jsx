import { redirect } from "next/navigation";
import { isAdminSetupAvailable } from "@/app/actions/admin-setup";
import AdminSetupForm from "./_components/admin-setup-form";

export const metadata = {
    title: "Admin Setup - First Time Configuration",
    description: "Bootstrap admin account setup"
};

export default async function AdminSetupPage() {
    // Check if setup is still available
    const setupAvailable = await isAdminSetupAvailable();
    
    if (!setupAvailable) {
        // Admin already exists - redirect to login
        redirect("/login");
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Admin Setup
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Create the first administrator account
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        This setup can only be completed once
                    </p>
                </div>
                
                <AdminSetupForm />
            </div>
        </div>
    );
}

