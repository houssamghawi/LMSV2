import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from 'bcryptjs';
import { authConfig } from "./auth.config";
import { rateLimit } from "./lib/rate-limit";

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET is not set in environment variables');
}

if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL) {
    console.warn('NEXTAUTH_URL is not set in production. This may cause issues with OAuth providers.');
}
 
export const {
    handlers: {GET, POST},
    auth,
    signIn,
    signOut,
} = NextAuth({
    ...authConfig,
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                try {
                    // Rate limiting - 5 attempts per 15 minutes per email
                    const rateLimitKey = `login:${credentials.email}`;
                    const rateLimitResult = rateLimit(rateLimitKey, 5, 15 * 60 * 1000);
                    
                    if (!rateLimitResult.success) {
                        // Don't reveal rate limit to prevent enumeration
                        return null;
                    }

                    // Dynamic imports to avoid loading in Edge Runtime (middleware)
                    const { User } = await import("./model/user-model");
                    const { dbConnect } = await import("./service/mongo");

                    // Ensure database connection
                    await dbConnect();

                    // Find user by email - explicitly select password (it's select: false by default)
                    const user = await User.findOne({ email: credentials.email })
                        .select('+password') // Explicitly include password field
                        .lean();

                    if (!user) {
                        // Use same delay as successful check to prevent timing attacks
                        await bcrypt.compare(credentials.password, '$2a$12$dummy.hash.to.prevent.timing.attacks');
                        return null;
                    }

                    // Check user status - prevent inactive/suspended users from logging in
                    if (user.status && user.status !== 'active') {
                        // Use same delay as successful check
                        await bcrypt.compare(credentials.password, '$2a$12$dummy.hash.to.prevent.timing.attacks');
                        return null;
                    }
                    
                    // Verify password
                    const isMatch = await bcrypt.compare(credentials.password, user.password);

                    if (!isMatch) {
                        return null;
                    }

                    // Update lastLogin timestamp
                    try {
                        await User.findByIdAndUpdate(user._id, { 
                            lastLogin: new Date() 
                        });
                    } catch (updateError) {
                        // Log but don't fail login if lastLogin update fails
                        console.error('Failed to update lastLogin:', updateError);
                    }
                    
                    // Return user data for session
                    return {
                        id: user._id.toString(),
                        email: user.email,
                        name: `${user.firstName} ${user.lastName}`,
                        role: user.role || 'student',
                        status: user.status || 'active',
                        image: user.profilePicture || null,
                    }; 

                } catch (err) {
                    // Log error but return null (NextAuth convention)
                    console.error('Auth error:', err);
                    return null;
                }  
            }
        })
    ]
})
