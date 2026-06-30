'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useLockBody } from '@/hooks/use-lock-body';
import { Button, buttonVariants } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useSession } from 'next-auth/react';

const MobileNav = ({ items, children }) => {
  const t = useTranslations('Navigation');
  const [isPending, startTransition] = useTransition();
  const { locale } = useParams();
  const pathname = usePathname();
  const router = useRouter();
  useLockBody();

  const { data: session } = useSession();

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
  const [loginSession, setLoginSession] = useState(null);

  useEffect(() => {
    setLoginSession(session);
  }, [session]);

  return (
    <div
      className={cn(
        'fixed inset-0 top-16 z-30 grid h-[calc(100vh-4rem)] grid-flow-row auto-rows-max overflow-auto p-6 pb-32 shadow-md animate-in slide-in-from-bottom-80 lg:hidden'
      )}
    >
      <div className='relative z-20 grid gap-6 rounded-md bg-popover p-4 text-popover-foreground shadow-md border'>
        <button
          onClick={switchLanguage}
          className='flex w-full items-center rounded-md p-2 text-sm font-medium hover:underline text-start'
          aria-label={locale === 'en' ? t('localeAr') : t('localeEn')}
        >
          {locale === 'en' ? t('localeAr') : t('localeEn')}
        </button>
        <nav className='grid grid-flow-row auto-rows-auto text-sm'>
          {items.map((item, index) => (
            <Link
              key={index}
              href={item.disable ? '#' : item.href}
              className={cn(
                'flex w-full items-center rounded-md p-2 text-sm font-medium hover:underline',
                item.disable && 'cursor-not-allowed opacity-60'
              )}
            >
              {item.titleKey ? t(item.titleKey) : item.title}
            </Link>
          ))}
        </nav>

        {!loginSession && (
          <div className='items-center gap-3 flex lg:hidden'>
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
      </div>
    </div>
  );
};

export default MobileNav;
