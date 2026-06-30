'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import Logo from './logo';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button, buttonVariants } from './ui/button';
import { Menu } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import MobileNav from './mobile-nav';
import { useSession, signOut } from 'next-auth/react';

const MainNav = ({ items, children }) => {
  const t = useTranslations('Navigation');
  const [isPending, startTransition] = useTransition();
  const { locale } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [loginSession, setLoginSession] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    setLoginSession(session);
    async function fetchMe() {
      try {
        const response = await fetch('/api/me');
        const data = await response.json();
        setLoggedInUser(data);
      } catch (error) {
        console.log(error);
      }
    }
    fetchMe();
  }, [session]);

  const switchLanguage = () => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar';

    startTransition(() => {
      // 1. Force the HTML tag to update instantly on the client
      document.documentElement.dir = nextLocale === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = nextLocale;

      // 2. Change the route using next-intl router
      router.replace(pathname, { locale: nextLocale });

      // 3. Force Next.js to re-fetch Server Components and clear client cache
      router.refresh();
    });
  };

  return (
    <>
      <div className='flex gap-6 lg:gap-10'>
        <Link href='/'>
          <Logo />
        </Link>
        {items?.length ? (
          <nav className='hidden gap-6 lg:flex'>
            {items?.map((item, index) => (
              <Link
                key={index}
                href={item.disable ? '#' : item.href}
                className={cn('flex items-center text-lg font-medium transition-colors hover:text-foreground/80 sm:text-sm')}
              >
                {item.titleKey ? t(item.titleKey) : item.title}
              </Link>
            ))}
          </nav>
        ) : null}

        {showMobileMenu && items && <MobileNav items={items}>{children}</MobileNav>}
      </div>

      <nav className='flex items-center gap-3'>
        <button
          onClick={switchLanguage}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-sm font-medium')}
          aria-label={locale === 'en' ? t('localeAr') : t('localeEn')}
        >
          {locale === 'en' ? t('localeAr') : t('localeEn')}
        </button>

        {!loginSession && (
          <div className='items-center gap-3 hidden lg:flex'>
            <Link href='/login' className={cn(buttonVariants({ size: 'sm' }), 'px-4')}>
              {t('login')}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm'>{t('register')}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-56 mt-4'>
                <DropdownMenuItem className='cursor-pointer' asChild>
                  <Link href='/register/student'>{t('student')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem className='cursor-pointer' asChild>
                  <Link href='/register/instructor'>{t('instructor')}</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {loginSession && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className='cursor-pointer'>
                <Avatar>
                  <AvatarImage src={loggedInUser?.profilePicture} alt="@ariyan" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align='end' className='w-56 mt-4'>
              <DropdownMenuItem className='cursor-pointer' asChild>
                <Link href='/account'>{t('profile')}</Link>
              </DropdownMenuItem>

              {loggedInUser?.role === 'instructor' && (
                <DropdownMenuItem className='cursor-pointer' asChild>
                  <Link href='/dashboard'>
                    <strong>{t('instructorDashboard')}</strong>
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem className='cursor-pointer' asChild>
                <Link href='/account/enrolled-courses'>{t('myCourses')}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem className='cursor-pointer' asChild>
                <Link href=''>{t('testimonialsCertificates')}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className='cursor-pointer'
                onClick={() => signOut({ callbackUrl: '/' })}
              >
                {t('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <button
          className='flex items-center gap-x-2 lg:hidden'
          onClick={() => setShowMobileMenu(!showMobileMenu)}
        >
          {showMobileMenu ? <X /> : <Menu />}
        </button>
      </nav>
    </>
  );
};

export default MainNav;
