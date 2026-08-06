"use client";

import { Logo } from "@/components/logo";
import { MobileSidebar } from "./mobile-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { getSafeImageUrl } from "@/lib/image-utils";
import { useParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Navbar = () => {
  const t = useTranslations("Dashboard");
  const tNav = useTranslations("Navigation");
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [isPending, startTransition] = useTransition();
  const { locale } = useParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {  
      async function fetchMe() {
          try {
              const response = await fetch("/api/me", {
                  cache: 'no-store' // Always fetch fresh data
              });
              if (response.ok) {
                  const data = await response.json();
                  setLoggedInUser(data);
              }
          } catch (error) {
              console.error('Failed to fetch user:', error);
          }
      }
      fetchMe();
      
      // Refresh user data when window regains focus (in case avatar was updated in another tab)
      const handleFocus = () => {
          fetchMe();
      };
      window.addEventListener('focus', handleFocus);
      
      return () => {
          window.removeEventListener('focus', handleFocus);
      };
  },[]);

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
    <div className="p-4 border-b h-full flex items-center bg-white shadow-sm">
      <MobileSidebar />
      <div className="flex items-center justify-end gap-3 w-full">
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
            <div className="cursor-pointer">
              <Avatar>
                <AvatarImage
                  src={getSafeImageUrl(loggedInUser?.profilePicture)}
                  alt={loggedInUser?.firstName || t("user")}
                  onError={(e) => {
                    e.target.src = '/assets/images/profile.jpg';
                  }}
                />
                <AvatarFallback>
                  {loggedInUser?.firstName?.[0] || t("userFallback")}
                  {loggedInUser?.lastName?.[0] || ""}
                </AvatarFallback>
              </Avatar>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-4">
          
          <DropdownMenuItem className="cursor-pointer">
              <Link href="/account">{t("profile")}</Link>
           </DropdownMenuItem>

            <DropdownMenuItem className="cursor-pointer">
              <Link
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  signOut({ callbackUrl: "/" });
                }}
              >
                {t("logout")}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
