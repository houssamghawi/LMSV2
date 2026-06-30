"use client"
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserInfo } from '@/app/actions/account';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const ContactInfo = ({userInfo}) => {
    const router = useRouter();
    const t = useTranslations('Account');
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
            toast.success(t("contactUpdatedSuccess"));
            router.refresh();
        } catch (error) {
            toast.error(error?.message || t("contactUpdateFailed"));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div>
            <h5 className="text-lg font-semibold mb-4">{t("contactInfo")} :</h5>
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-5">
                    <div>
                        <Label className="mb-2 block">{t("phoneNo")} :</Label>
                        <Input
                            name="phone"
                            id="phone"
                            type="tel"
                            value={contactState.phone}
                            onChange={handleChange}
                            placeholder={t("phonePlaceholder")}
                            disabled={isSubmitting}
                        />
                    </div>
                </div>
                <Button className="mt-5" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? t("saving") : t("saveContactInfo")}
                </Button>
            </form>
        </div>
    );
};

export default ContactInfo;