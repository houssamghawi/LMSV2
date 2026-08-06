import React from 'react';
import { getTranslations } from 'next-intl/server';
import Logo from './logo';

const SiteFooter = async () => {
    const t = await getTranslations('Footer');
    return (
<footer>
    <div className='container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0'>
        <div className='flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0 md:ms-auto'>
            <Logo/>
        <p className='text-center text-sm leading-loose md:text-start'>{t('builtBy')}</p>
            
        </div>

    </div>
    
</footer>
    );
};

export default SiteFooter;