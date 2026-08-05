"use client"
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserInfo } from '@/app/actions/account';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const ContactInfo = ({userInfo}) => {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [contactState, setContactState] = useState({
        phone: userInfo?.phone || "",
    });

    useEffect(() => {
        if (userInfo) {
            setContactState({
                phone: userInfo.phone || "",
            });
        }
    }, [userInfo]);

    const handleChange = (event) => {
        const field = event.target.name;
        const value = event.target.value;
        setContactState({
            ...contactState, [field]: value
        });
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        
        try {
            await updateUserInfo(userInfo?.email, contactState);
            toast.success("Contact information updated successfully");
            router.refresh();
        } catch (error) {
            toast.error(error?.message || "Failed to update contact information");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div>
            <h5 className="text-lg font-semibold mb-4">Contact Info :</h5>
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-5">
                    <div>
                        <Label className="mb-2 block">Phone No. :</Label>
                        <Input
                            name="phone"
                            id="phone"
                            type="tel"
                            value={contactState.phone}
                            onChange={handleChange}
                            placeholder="Phone number"
                            disabled={isSubmitting}
                        />
                    </div>
                </div>
                <Button className="mt-5" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Contact Info"}
                </Button>
            </form>
        </div>
    );
};

export default ContactInfo;