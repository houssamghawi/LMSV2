import React from 'react';
import Menu from './account-menu';
import { ProfileImageUpload } from './profile-image-upload';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getUserByEmail } from '@/queries/users';
import { getTranslations } from 'next-intl/server';

const AccountSidebar = async () => {
    const t = await getTranslations('Account');
    try {
        const session = await auth();
        if (!session?.user?.email) {
            redirect("/login");
        }

        const loggedInUser = await getUserByEmail(session?.user?.email);
        
        if (!loggedInUser) {
            redirect("/login");
        }

    return (
<div className="lg:w-1/4 md:px-3">
<div className="relative">
    <div className="p-6 rounded-md shadow dark:shadow-gray-800 bg-white dark:bg-slate-900">
        <div className="profile-pic text-center mb-5">
            <ProfileImageUpload 
                currentImageUrl={loggedInUser?.profilePicture}
                userEmail={loggedInUser?.email}
            />
            <div className="mt-4">
                <h5 className="text-lg font-semibold">
                    {`${loggedInUser?.firstName} ${loggedInUser?.lastName}`}
                </h5>
                <p className="text-slate-400">
                    {loggedInUser?.email}
                </p>
                <p className="text-slate-700 text-sm font-bold">
                    {t('role')}: {loggedInUser?.role}
                </p>
            </div>
        </div>
        <div className="border-t border-gray-100 dark:border-gray-700">
            <Menu />
        </div>
    </div>
</div>
</div>
    );
    } catch (error) {
        console.error('Account sidebar error:', error);
        redirect("/login");
    }
};

export default AccountSidebar;