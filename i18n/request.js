import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

const messagesByLocale = {
  en: () => import('../messages/en.json'),
  ar: () => import('../messages/ar.json'),
};

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale)) {
    locale = routing.defaultLocale;
  }

  const messages = (await messagesByLocale[locale]()).default;

  return {
    locale,
    messages,
    timeZone: 'UTC',
    dir: locale === 'ar' ? 'rtl' : 'ltr',
  };
});
