import { auth } from "@/auth"
import { getUserByEmail } from "@/queries/users";
import { dbConnect } from "@/service/mongo";
import { NextResponse } from "next/server";

export const GET = async (request) => {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        
        await dbConnect();
        const user = await getUserByEmail(session?.user?.email);
        
        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }
        
        return NextResponse.json(user, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('API /me error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    } 
}