import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getRedirectUrlByRole } from '@/lib/auth-redirect';
import { SignupForm } from '../_components/signup-form';

const RegisterPage = async ({ params }) => {
    const { role } = await params;
    
    // Redirect logged-in users away from registration
    const session = await auth();
    if (session?.user?.role) {
        const redirectUrl = getRedirectUrlByRole(session.user.role);
        redirect(redirectUrl);
    }
    
    return (
        <div className='w-full flex-col h-screen flex items-center justify-center'>
            <div className='container'>
                <SignupForm role={role} />
            </div>
        </div>
    );
};

export default RegisterPage;