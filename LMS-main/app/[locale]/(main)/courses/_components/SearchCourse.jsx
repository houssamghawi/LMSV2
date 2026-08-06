'use client'
import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

const SearchCourse = () => {
    const t = useTranslations('Courses');
    return (
        <div className="relative h-10 max-lg:w-full">
          <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-gray-500 z-10 h-4 w-4" />
          <Input
            type="text"
            placeholder={t('searchPlaceholder')}
            className="ps-8 pe-3 py-2 text-sm"
          />
        </div>
    );
};

export default SearchCourse;