"use client"
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from '@/app/actions/account';
import { toast } from 'sonner';

const ChangePassword = ({email}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [passwordState, setPasswordState] = useState({
        "oldPassword" : "",
        "newPassword" : "",
        "confirmPassword" : ""
    });
    const [errors, setErrors] = useState({});

    const handleChange = (event) => {
        const key = event.target.name;
        const value = event.target.value;
        setPasswordState({
            ...passwordState, [key]: value
        });
        // Clear error for this field
        if (errors[key]) {
            setErrors({ ...errors, [key]: '' });
        }
    }

    const validateForm = () => {
        const newErrors = {};
        
        if (!passwordState.oldPassword) {
            newErrors.oldPassword = 'Current password is required';
        }
        
        if (!passwordState.newPassword) {
            newErrors.newPassword = 'New password is required';
        } else if (passwordState.newPassword.length < 8) {
            newErrors.newPassword = 'Password must be at least 8 characters';
        }
        
        if (!passwordState.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (passwordState.newPassword !== passwordState.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    async function doPasswordChange(event) {
        event.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        try {
            await changePassword(
                email,
                passwordState.oldPassword,
                passwordState.newPassword,
                passwordState.confirmPassword
            );
            toast.success("Password changed successfully");
            // Reset form
            setPasswordState({
                oldPassword: "",
                newPassword: "",
                confirmPassword: ""
            });
        } catch (error) {
            toast.error(error?.message || "Failed to change password");
        } finally {
            setIsSubmitting(false);
        }
    }



    return (
        <div>
<h5 className="text-lg font-semibold mb-4">
    Change password :
</h5>
<form onSubmit={doPasswordChange}>
    <div className="grid grid-cols-1 gap-5">
        <div>
            <Label className="mb-2 block">Old password :</Label>
            <Input
                type="password"
                id="oldPassword"
                name="oldPassword"
                value={passwordState.oldPassword}
                onChange={handleChange}
                placeholder="Old password"
                required
                disabled={isSubmitting}
            />
            {errors.oldPassword && (
                <p className="text-sm text-red-500 mt-1">{errors.oldPassword}</p>
            )}
        </div>
        <div>
            <Label className="mb-2 block">New password :</Label>
            <Input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwordState.newPassword}
                onChange={handleChange}
                placeholder="New password (min 8 characters)"
                required
                disabled={isSubmitting}
            />
            {errors.newPassword && (
                <p className="text-sm text-red-500 mt-1">{errors.newPassword}</p>
            )}
        </div>
        <div>
            <Label className="mb-2 block">
                Re-type New password :
            </Label>
            <Input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwordState.confirmPassword}
                onChange={handleChange}
                placeholder="Re-type New password"
                required
                disabled={isSubmitting}
            />
            {errors.confirmPassword && (
                <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>
            )}
        </div>
    </div>
    {/*end grid*/}
    <Button className="mt-5" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Changing..." : "Save password"}
    </Button>
</form>
</div>
    );
};

export default ChangePassword;