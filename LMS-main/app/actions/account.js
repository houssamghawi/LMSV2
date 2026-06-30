"use server"

import { sanitizeForClient } from "@/lib/utils/serialize";
import { User } from "@/model/user-model";
import { validatePassword } from "@/queries/users";
import { revalidatePath } from "next/cache"; 
import bcrypt from 'bcryptjs';
import { getLoggedInUser } from "@/lib/loggedin-user";
import { updateProfileSchema } from "@/lib/validations";
import { dbConnect } from "@/service/mongo";

export async function updateUserInfo(email, updatedData) {
    try {
        // Authentication check
        const loggedinUser = await getLoggedInUser();
        if (!loggedinUser) {
            throw new Error('Unauthorized: Please log in');
        }
        
        // Authorization check - user can only update their own info
        if (loggedinUser.email !== email) {
            throw new Error('Forbidden: You can only update your own information');
        }
        
        // Input validation
        const validationResult = updateProfileSchema.safeParse({
            ...updatedData,
            email: email // Ensure email matches
        });
        
        if (!validationResult.success) {
            const errors = validationResult.error.errors.map(e => e.message).join(', ');
            throw new Error(`Validation failed: ${errors}`);
        }
        
        // Ensure database connection
        await dbConnect();
        
        // Prepare update data (exclude email as it shouldn't be changed)
        const { email: _, ...dataToUpdate } = validationResult.data;
        
        // Sanitize empty strings to undefined for optional fields
        Object.keys(dataToUpdate).forEach(key => {
            if (dataToUpdate[key] === '') {
                dataToUpdate[key] = undefined;
            }
        });
        
        // Update user
        const updatedUser = await User.findOneAndUpdate(
            { email: email },
            { $set: dataToUpdate },
            { new: true, lean: true }
        );
        
        if (!updatedUser) {
            throw new Error('User not found');
        }
        
        // Revalidate paths to refresh data
        revalidatePath('/account');
        revalidatePath('/api/me');
        
        // If profile picture was updated, also revalidate avatar route
        if (dataToUpdate.profilePicture) {
            revalidatePath('/api/profile/avatar');
        }
        
        return { success: true, user: sanitizeForClient(updatedUser) };
    } catch (error) {
        console.error('Update user info error:', error);
        throw new Error(error?.message || 'Failed to update user information');
    }
}
// End method 

export async function changePassword(email, oldPassword, newPassword, confirmPassword) {
    try {
        // Authentication check
        const loggedinUser = await getLoggedInUser();
        if (!loggedinUser) {
            throw new Error('Unauthorized: Please log in');
        }
        
        // Authorization check - user can only change their own password
        if (loggedinUser.email !== email) {
            throw new Error('Forbidden: You can only change your own password');
        }
        
        // Input validation
        const { changePasswordSchema } = await import("@/lib/validations");
        const validationResult = changePasswordSchema.safeParse({
            oldPassword,
            newPassword,
            confirmPassword
        });
        
        if (!validationResult.success) {
            const errors = validationResult.error.errors.map(e => e.message).join(', ');
            throw new Error(`Validation failed: ${errors}`);
        }
        
        // Verify old password
        await dbConnect();
        const isMatch = await validatePassword(email, oldPassword);
        
        if (!isMatch) {
            throw new Error("Current password is incorrect");        
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        const updatedUser = await User.findOneAndUpdate(
            { email: email },
            { $set: { password: hashedPassword } },
            { new: true }
        );
        
        if (!updatedUser) {
            throw new Error('User not found');
        }
        
        // Revalidate paths
        revalidatePath('/account');
        
        return { success: true };
    } catch (error) {
        console.error('Change password error:', error);
        throw new Error(error?.message || 'Failed to change password');
    } 
}