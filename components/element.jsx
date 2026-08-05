import Image from 'next/image';
import React from 'react';
import { getTranslations } from 'next-intl/server';
 
const Element = async () => {
    const t = await getTranslations('Landing');
    return (
<div className='bg-darkBlue min-h-screen px-0 py-12'>
    <div className='w-full bg-fuchsia-50 p-6 flex flex-col md:flex-row items-center pt-5 pb-10 ps-10'>
        <div className='md:w-1/2 text-center md:text-start pt-10 pb-10'>
        <h3 className='text-blue-600 font-semibold text-lg mb-2'>{t('fastTrackLearning')}</h3>
        <h2 className='text-gray-800 font-bold text-5xl mb-4'>{t('learnByDoingTitle')}</h2>
        <p className='text-gray-600'>{t('learnByDoingDesc')}</p>
        </div>  

    <div className='md:w-1/2 flex justify-center mt-6 md:mt-0'>
        <Image
            src="/assets/images/two.png"
            alt={t('learningByDoingAlt')}
            width={500}
            height={400}
            className='rounded-lg' 
        /> 
    </div> 
    </div>

    <div className='w-full bg-blue-50 p-6 flex flex-col md:flex-row items-center pt-5 pb-10 ps-10'>
    <div className='md:w-1/2 flex justify-center mb-6 md:mb-0'>
    <Image
            src="/assets/images/one.png"
            alt={t('putYourLearningAlt')}
            width={500}
            height={400}
            className='rounded-lg' 
        />  
    </div>

    <div className='md:w-1/2 text-center md:text-start'>
        <h3 className='text-green-600 font-semibold text-lg mb-2'>{t('stepByStepLessons')}</h3>
        <h2 className='text-gray-800 font-bold text-5xl mb-4'>{t('putYourLearning')}</h2>
        <p className='text-gray-600'>{t('putYourLearningDesc')}</p>
        </div>  
    </div> 
    
</div>
    );
};

export default Element;