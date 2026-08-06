"use client";

import { signOut } from "next-auth/react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SafeImage } from "@/components/safe-image";
import { LogOut, User } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

export default function AdminNavbar({ user }) {
    const t = useTranslations("Admin");
    const tNav = useTranslations("Navigation");
    const [isPending, startTransition] = useTransition();
    const { locale } = useParams();
    const pathname = usePathname();
    const router = useRouter();

    const switchLanguage = () => {
        const nextLocale = locale === 'ar' ? 'en' : 'ar';
        startTransition(() => {
            document.documentElement.dir = nextLocale === 'ar' ? 'rtl' : 'ltr';
            document.documentElement.lang = nextLocale;
            router.replace(pathname, { locale: nextLocale });
            router.refresh();
        });
    };

    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{t("adminDashboard")}</h2>
                    <p className="text-sm text-gray-500">{t("manageYourPlatform")}</p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={switchLanguage}
                        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-sm font-medium')}
                        aria-label={locale === 'en' ? tNav('localeAr') : tNav('localeEn')}
                        disabled={isPending}
                    >
                        {locale === 'en' ? tNav('localeAr') : tNav('localeEn')}
                    </button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                <Avatar className="h-10 w-10">
                                    <SafeImage
                                        src={user?.profilePicture}
                                        alt={user?.name || t("admin")}
                                        width={40}
                                        height={40}
                                        fallback="/assets/images/profile.jpg"
                                    />
                                    <AvatarFallback>
                                        {user?.name?.charAt(0) || "A"}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem asChild>
                                <Link href="/account" className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    {t("profile")}
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => signOut({ callbackUrl: "/" })}
                                className="text-red-600 cursor-pointer"
                            >
                                <LogOut className="h-4 w-4 me-2 rtl:rotate-180" />
                                {t("logout")}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}

