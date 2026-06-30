"use client"
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateUserInfo } from '@/app/actions/account';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const PersonalDetails = ({userInfo}) => {
    const router = useRouter();
    const t = useTranslations('Account');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [infoState, setInfoState] = useState({
        "firstName" : userInfo?.firstName || "",
        "lastName" : userInfo?.lastName || "",
        "email" : userInfo?.email || "",
        "designation" : userInfo?.designation || "",
        "bio" : userInfo?.bio || "", 
    });

    // Update state when userInfo changes
    useEffect(() => {
        if (userInfo) {
            setInfoState({
                "firstName" : userInfo.firstName || "",
                "lastName" : userInfo.lastName || "",
                "email" : userInfo.email || "",
                "designation" : userInfo.designation || "",
                "bio" : userInfo.bio || "", 
            });
        }
    }, [userInfo]);

    const handleChange = (event) => {
        const field = event.target.name;
        const value = event.target.value;
        setInfoState({
            ...infoState, [field]: value
        });
    }

    const handleUpdate = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        
        try {
            await updateUserInfo(userInfo?.email, infoState);
            toast.success(t("profileUpdatedSuccess"));
            // Refresh the page to show updated data
            router.refresh();
        } catch (error) {
            toast.error(error?.message || t("profileUpdateFailed"));
        } finally {
            setIsSubmitting(false);
        }
    }



    return (
<div className="p-6 rounded-md shadow dark:shadow-gray-800 bg-white dark:bg-slate-900">
    <h5 className="text-lg font-semibold mb-4">{t("personalDetails")} :</h5>
    <form onSubmit={handleUpdate} >
        <div className="grid lg:grid-cols-2 grid-cols-1 gap-5">
            <div>
                <Label className="mb-2 block">
                    {t("firstName")} : <span className="text-red-600">*</span>
                </Label>
                <Input
                    type="text"
                    placeholder={`${t("firstName")}:`}
                    id="firstName"
                    name="firstName"
                    value={infoState?.firstName}
                    onChange={handleChange}
                    required
                />
            </div>
            <div>
                <Label className="mb-2 block">
                    {t("lastName")} : <span className="text-red-600">*</span>
                </Label>
                <Input
                    type="text"
                    placeholder={`${t("lastName")}:`}
                    id="lastName"
                    name="lastName"
                    value={infoState?.lastName}
                    onChange={handleChange}
                    required
                />
            </div>
            <div>
                <Label className="mb-2 block">
                    {t("yourEmail")} : <span className="text-red-600">*</span>
                </Label>
                <Input
                    type="email"
                    placeholder={t("yourEmail")}
                    id="email"
                    name="email"
                    value={infoState?.email}
                    disabled
                />
            </div>
            <div>
                <Label className="mb-2 block">{t("occupation")} :</Label>
                <Input
                    id="designation"
                    name="designation"
                    value={infoState?.designation}
                    type="text"
                    onChange={handleChange}
                    placeholder={`${t("occupation")} :`}
                />
            </div>
        </div>
        {/*end grid*/}
        <div className="grid grid-cols-1">
            <div className="mt-5">
                <Label className="mb-2 block">{t("description")} :</Label>
                <Textarea
                    id="bio"
                    name="bio"
                    value={infoState?.bio}
                    onChange={handleChange}
                    placeholder={`${t("messagePlaceholder")} :`}
                />
            </div>
        </div>
        {/*end row*/}
        <Button className="mt-5" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("saving") : t("saveChanges")}
        </Button>
    </form>
    {/*end form*/}
</div>
    );
};

export default PersonalDetails;